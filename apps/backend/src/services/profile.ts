import { prisma } from '../db/prisma';
import { createPresignedDownload } from './s3';
import { env } from '../config/env';
import { getMfaPolicy, isMfaRequired } from './mfaPolicy';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const policy = await getMfaPolicy();
  const mfaRequired = isMfaRequired(user, policy);

  let avatarUrl: string | null = null;
  if (user.avatarFileId) {
    const file = await prisma.file.findUnique({ where: { id: user.avatarFileId } });
    if (file && file.status === 'active') {
      avatarUrl = await createPresignedDownload({
        bucket: file.bucket,
        key: file.objectKey,
        expiresInSeconds: env.s3PresignGetTtlSeconds
      });
    }
  }

  const oauthAccounts = await prisma.oAuthAccount.findMany({
    where: { userId },
    select: { provider: true }
  });
  const connected_accounts = oauthAccounts.map((acc: { provider: string }) => acc.provider);

  const backupCodesRemaining = await prisma.backupCode.count({
    where: { userId, usedAt: null }
  });

  return {
    id: user.id,
    email: user.email,
    has_password: Boolean(user.passwordHash),
    first_name: user.firstName,
    last_name: user.lastName,
    username: user.username,
    nationality: user.nationality,
    locale: user.locale,
    roles: user.roles,
    avatar_url: avatarUrl,
    mfa_enabled: user.mfaEnabled,
    mfa_required: mfaRequired,
    email_verified_at: user.emailVerifiedAt,
    phone_verified_at: user.phoneVerifiedAt,
    recovery_email: user.recoveryEmail,
    recovery_email_verified_at: user.recoveryEmailVerifiedAt,
    recovery_email_pending: user.recoveryEmailPending,
    security_alert_email_enabled: user.securityAlertEmailEnabled,
    security_alert_sms_enabled: user.securityAlertSmsEnabled,
    backup_codes_remaining: backupCodesRemaining,
    onboarding_completed_at: user.onboardingCompletedAt,
    deleted_at: user.deletedAt,
    connected_accounts
  };
}

export async function updateProfile(params: {
  userId: string;
  data: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    nationality?: string | null;
    locale?: string | null;
  };
}) {
  const data: Record<string, string | null> = {};
  if (params.data.firstName !== undefined) data.firstName = params.data.firstName;
  if (params.data.lastName !== undefined) data.lastName = params.data.lastName;
  if (params.data.username !== undefined) data.username = params.data.username;
  if (params.data.nationality !== undefined) data.nationality = params.data.nationality;
  if (params.data.locale !== undefined) data.locale = params.data.locale;

  return prisma.user.update({
    where: { id: params.userId },
    data
  });
}

export async function completeOnboarding(params: {
  userId: string;
  data: {
    firstName: string;
    lastName: string;
    username: string;
    nationality: string;
  };
}) {
  return prisma.user.update({
    where: { id: params.userId },
    data: {
      firstName: params.data.firstName,
      lastName: params.data.lastName,
      username: params.data.username,
      nationality: params.data.nationality,
      onboardingCompletedAt: new Date()
    }
  });
}

export async function getOnboardingStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const missing = [
    user.firstName ? null : 'first_name',
    user.lastName ? null : 'last_name',
    user.username ? null : 'username',
    user.nationality ? null : 'nationality'
  ].filter(Boolean) as string[];

  return {
    completed: Boolean(user.onboardingCompletedAt),
    missing_fields: missing,
    onboarding_completed_at: user.onboardingCompletedAt
  };
}
