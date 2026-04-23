import { AuthAttemptType, UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import { recordAuthAttempt } from '../../../services/authAttempts';
import { getMfaPolicy, isMfaRequired } from '../../../services/mfaPolicy';
import { createSession, revokeAllSessions, revokeSession, rotateSession } from '../../../services/session';
import { maybeSendLoginAlert } from '../../../services/securityAlerts';
import { hashToken } from '../../../utils/crypto';
import { verifyPassword } from '../../../utils/password';
import { normalizeEmail, normalizeUsername } from '../../../utils/normalize';
import {
  enforceCaptchaIfNeeded,
  hashIdentifierForAudit,
  hasKnownDeviceSession
} from '../shared/service-helpers';

type LoginInput = {
  email?: string | undefined;
  identifier?: string | undefined;
  password: string;
  captchaToken?: string | undefined;
};

type SessionMeta = {
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

export type LoginResult =
  | { kind: 'success'; accessToken: string; refreshToken: string }
  | { kind: 'mfa_setup_required'; accessToken: string; refreshToken: string; userId: string }
  | { kind: 'mfa_challenge_required'; userId: string };

export type RefreshResult =
  | { kind: 'success'; accessToken: string; refreshToken: string }
  | { kind: 'mfa_setup_required'; accessToken: string; refreshToken: string; userId: string };

export async function loginUser(input: LoginInput, meta: SessionMeta, requestId: string): Promise<LoginResult> {
  const identifierRaw = (input.email ?? input.identifier ?? '').trim();
  const identifierLooksEmail = identifierRaw.includes('@');
  const normalizedIdentifierEmail = identifierLooksEmail ? normalizeEmail(identifierRaw) : null;
  const normalizedIdentifierUsername = normalizeUsername(identifierRaw);

  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.login,
    email: identifierLooksEmail ? (normalizedIdentifierEmail ?? identifierRaw) : null,
    ip: meta.ip ?? null,
    captchaToken: input.captchaToken
  });
  if (captchaCheck.required && !captchaCheck.valid) {
    throw new Error('CAPTCHA_REQUIRED');
  }

  let user = null as Awaited<ReturnType<typeof prisma.user.findFirst>>;
  if (identifierLooksEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: normalizedIdentifierEmail ?? identifierRaw, mode: 'insensitive' } }
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { username: { equals: normalizedIdentifierUsername, mode: 'insensitive' } }
      });
    }
  } else {
    user = await prisma.user.findFirst({
      where: { username: { equals: normalizedIdentifierUsername, mode: 'insensitive' } }
    });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { email: { equals: normalizeEmail(identifierRaw), mode: 'insensitive' } }
      });
    }
  }

  if (!user || !user.passwordHash || user.status === UserStatus.banned || user.deletedAt) {
    await recordAuthAttempt({
      type: AuthAttemptType.login,
      email: identifierLooksEmail ? (normalizedIdentifierEmail ?? identifierRaw) : null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId: user?.id ?? null
    });
    await writeAuditLog({
      actorUserId: user?.id ?? null,
      actorIp: meta.ip ?? null,
      action: 'LOGIN_FAIL',
      targetType: 'user',
      targetId: user?.id ?? null,
      metadata: { identifier_hash: hashIdentifierForAudit(identifierRaw), reason: 'USER_NOT_FOUND_OR_BANNED' },
      requestId
    });
    throw new Error('INVALID_CREDENTIALS');
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    await recordAuthAttempt({
      type: AuthAttemptType.login,
      email: user.email,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId: user.id
    });
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'LOGIN_FAIL',
      targetType: 'user',
      targetId: user.id,
      metadata: { identifier_hash: hashIdentifierForAudit(identifierRaw), reason: 'PASSWORD_INVALID' },
      requestId
    });
    throw new Error('INVALID_CREDENTIALS');
  }

  await recordAuthAttempt({
    type: AuthAttemptType.login,
    email: user.email,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    success: true,
    userId: user.id
  });

  if (!user.emailVerifiedAt) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  if (user.status !== UserStatus.active) {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.active }
    });
  }

  const policy = await getMfaPolicy();
  if (isMfaRequired(user, policy) && !user.mfaEnabled) {
    const session = await createSession({
      userId: user.id,
      roles: user.roles as unknown as string[],
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'MFA_SETUP_REQUIRED',
      targetType: 'user',
      targetId: user.id,
      metadata: {},
      requestId
    });
    return {
      kind: 'mfa_setup_required',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: user.id
    };
  }

  if (user.mfaEnabled) {
    return { kind: 'mfa_challenge_required', userId: user.id };
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

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip ?? null,
    action: 'LOGIN_SUCCESS',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId
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
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}

export async function logoutUser(refreshToken: string | undefined, ip: string | null, requestId: string) {
  if (!refreshToken) {
    return;
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash } });
  if (!session) {
    return;
  }

  await revokeSession(session.id);
  await writeAuditLog({
    actorUserId: session.userId,
    actorIp: ip,
    action: 'LOGOUT',
    targetType: 'session',
    targetId: session.id,
    metadata: {},
    requestId
  });
}

export async function refreshUserSession(
  refreshToken: string,
  meta: SessionMeta,
  requestId: string
): Promise<RefreshResult> {
  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash } });
  if (!session) {
    throw new Error('REFRESH_TOKEN_INVALID');
  }

  if (session.revokedAt) {
    throw new Error('REFRESH_TOKEN_REVOKED');
  }

  if (session.rotatedAt) {
    await revokeAllSessions(session.userId);
    await writeAuditLog({
      actorUserId: session.userId,
      actorIp: meta.ip ?? null,
      action: 'REFRESH_REUSE_DETECTED',
      targetType: 'session',
      targetId: session.id,
      metadata: {},
      requestId
    });
    throw new Error('REFRESH_REUSE_DETECTED');
  }

  const now = new Date();
  if (session.expiresAt < now) {
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  const idleTimeoutMs = env.idleTimeoutMinutes * 60 * 1000;
  const reauthMaxMs = env.reauthMaxHours * 60 * 60 * 1000;

  if (now.getTime() - session.lastUsedAt.getTime() > idleTimeoutMs) {
    await revokeSession(session.id);
    throw new Error('SESSION_IDLE_TIMEOUT');
  }

  if (now.getTime() - session.createdAt.getTime() > reauthMaxMs) {
    await revokeSession(session.id);
    throw new Error('SESSION_REAUTH_REQUIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== UserStatus.active || user.deletedAt) {
    throw new Error('AUTH_REQUIRED');
  }

  const policy = await getMfaPolicy();
  if (isMfaRequired(user, policy) && !user.mfaEnabled) {
    const rotated = await rotateSession({
      sessionId: session.id,
      userId: session.userId,
      roles: user.roles as unknown as string[],
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });
    return {
      kind: 'mfa_setup_required',
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      userId: user.id
    };
  }

  const rotated = await rotateSession({
    sessionId: session.id,
    userId: session.userId,
    roles: user.roles as unknown as string[],
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null
  });

  await writeAuditLog({
    actorUserId: session.userId,
    actorIp: meta.ip ?? null,
    action: 'REFRESH_ROTATED',
    targetType: 'session',
    targetId: session.id,
    metadata: {},
    requestId
  });

  return {
    kind: 'success',
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken
  };
}
