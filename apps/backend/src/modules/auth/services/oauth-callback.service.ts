import { UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { getMfaPolicy, isMfaRequired } from '../../../services/mfaPolicy';
import { exchangeOAuthCode, fetchOAuthProfile, getOAuthRedirectUri } from '../../../services/oauth';
import { createSession } from '../../../services/session';
import { maybeSendLoginAlert } from '../../../services/securityAlerts';
import { issueEmailVerification, hasKnownDeviceSession } from '../shared/service-helpers';

type OAuthCallbackMeta = {
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

export type OAuthCallbackResult =
  | { kind: 'redirect_error'; reason?: string | undefined }
  | { kind: 'success'; next: 'dashboard' | 'complete-profile' | 'setup-mfa'; accessToken: string; refreshToken: string; onboardingUserId?: string | undefined }
  | { kind: 'mfa_challenge'; userId: string };

export async function completeOAuthCallback(params: {
  provider: 'google' | 'github';
  code: string;
  state: string;
  stateCookie?: string | undefined;
  nonceCookie?: string | undefined;
  verifierCookie?: string | undefined;
  meta: OAuthCallbackMeta;
  requestId: string;
}): Promise<OAuthCallbackResult> {
  const { provider, code, state, stateCookie, nonceCookie, verifierCookie, meta, requestId } = params;
  if (!stateCookie || !nonceCookie || !verifierCookie || stateCookie !== state) {
    return { kind: 'redirect_error' };
  }

  const nonceFromState = state.split('.')[1];
  if (!nonceFromState || nonceFromState !== nonceCookie) {
    return { kind: 'redirect_error' };
  }

  try {
    const token = await exchangeOAuthCode({
      provider,
      code,
      codeVerifier: verifierCookie,
      redirectUri: getOAuthRedirectUri(provider)
    });

    const profile = await fetchOAuthProfile({ provider, accessToken: token.accessToken });
    if (!profile.email) {
      return { kind: 'redirect_error' };
    }

    let user = await prisma.user.findFirst({
      where: { email: { equals: profile.email.trim().toLowerCase(), mode: 'insensitive' } }
    });

    const normalizedEmail = profile.email.trim().toLowerCase();
    const emailVerified = profile.emailVerified || Boolean(user?.emailVerifiedAt);

    if (!emailVerified) {
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            status: UserStatus.pending_email,
            roles: ['user']
          }
        });
      }

      await prisma.oAuthAccount.upsert({
        where: {
          oauth_accounts_provider_provider_user_id_key: {
            provider,
            providerUserId: profile.providerUserId
          }
        },
        update: {
          userId: user.id,
          emailAtProvider: normalizedEmail
        },
        create: {
          provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
          emailAtProvider: normalizedEmail
        }
      });

      await issueEmailVerification({
        userId: user.id,
        email: normalizedEmail,
        requestId,
        ip: meta.ip ?? null
      });

      await writeAuditLog({
        actorUserId: user.id,
        actorIp: meta.ip ?? null,
        action: 'OAUTH_EMAIL_UNVERIFIED',
        targetType: 'user',
        targetId: user.id,
        metadata: { provider },
        requestId
      });

      return { kind: 'redirect_error', reason: 'email_not_verified' };
    }

    if (user) {
      if (!user.emailVerifiedAt || user.status !== UserStatus.active) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            status: UserStatus.active
          }
        });
      }

      await prisma.oAuthAccount.upsert({
        where: {
          oauth_accounts_provider_provider_user_id_key: {
            provider,
            providerUserId: profile.providerUserId
          }
        },
        update: {
          userId: user.id,
          emailAtProvider: normalizedEmail
        },
        create: {
          provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
          emailAtProvider: normalizedEmail
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          status: UserStatus.active,
          emailVerifiedAt: new Date(),
          roles: ['user']
        }
      });

      await prisma.oAuthAccount.create({
        data: {
          provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
          emailAtProvider: normalizedEmail
        }
      });
    }

    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'OAUTH_LINKED',
      targetType: 'user',
      targetId: user.id,
      metadata: { provider },
      requestId
    });

    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'OAUTH_CALLBACK_SUCCESS',
      targetType: 'user',
      targetId: user.id,
      metadata: { provider },
      requestId
    });

    const hasProfileFields = Boolean(user.firstName && user.lastName && user.username && user.nationality);
    if (hasProfileFields && !user.onboardingCompletedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { onboardingCompletedAt: new Date(), status: UserStatus.active }
      });
    }

    const profileComplete = Boolean(user.onboardingCompletedAt);
    const policy = await getMfaPolicy();
    const mfaRequired = isMfaRequired(user, policy);

    if (profileComplete && mfaRequired && !user.mfaEnabled) {
      const knownDevice = await hasKnownDeviceSession({
        userId: user.id,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null
      });
      const session = await createSession({
        userId: user.id,
        roles: user.roles as unknown as string[],
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null
      });
      await maybeSendLoginAlert({
        userId: user.id,
        email: user.email,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        emailEnabled: user.securityAlertEmailEnabled,
        smsEnabled: user.securityAlertSmsEnabled,
        requestId,
        knownDevice
      });
      return {
        kind: 'success',
        next: 'setup-mfa',
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        onboardingUserId: user.id
      };
    }

    if (user.mfaEnabled && profileComplete) {
      return { kind: 'mfa_challenge', userId: user.id };
    }

    const knownDevice = await hasKnownDeviceSession({
      userId: user.id,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });
    const session = await createSession({
      userId: user.id,
      roles: user.roles as unknown as string[],
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });

    await maybeSendLoginAlert({
      userId: user.id,
      email: user.email,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      emailEnabled: user.securityAlertEmailEnabled,
      smsEnabled: user.securityAlertSmsEnabled,
      requestId,
      knownDevice
    });

    return {
      kind: 'success',
      next: profileComplete ? 'dashboard' : 'complete-profile',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken
    };
  } catch {
    await writeAuditLog({
      actorUserId: null,
      actorIp: meta.ip ?? null,
      action: 'OAUTH_CALLBACK_FAIL',
      targetType: 'oauth',
      targetId: provider,
      metadata: {},
      requestId
    });

    return { kind: 'redirect_error' };
  }
}
