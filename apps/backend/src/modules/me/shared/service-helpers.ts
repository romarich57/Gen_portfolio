import { AuthAttemptType } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { countRecentFailures } from '../../../services/authAttempts';
import { verifyCaptchaToken } from '../../../services/captcha';
import { hashToken } from '../../../utils/crypto';

export async function isUsernameAvailable(params: { userId: string; username: string }) {
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: params.username, mode: 'insensitive' },
      NOT: { id: params.userId }
    }
  });

  return !existing;
}

export async function hasRecentMfaIfEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true }
  });

  if (!user || !user.mfaEnabled) return true;

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null } },
    orderBy: { lastUsedAt: 'desc' }
  });

  if (!factor || !factor.lastUsedAt) return false;

  const maxAgeMs = env.reauthMaxHours * 60 * 60 * 1000;
  return Date.now() - factor.lastUsedAt.getTime() <= maxAgeMs;
}

export async function evaluateExportCaptcha(params: {
  email: string;
  ip?: string | null | undefined;
  captchaToken?: string | undefined;
}) {
  const failures = await countRecentFailures({
    type: AuthAttemptType.gdpr_export,
    email: params.email,
    ip: params.ip ?? null,
    windowMinutes: 60
  });

  if (failures < 2) return { required: false, valid: true };

  const valid = await verifyCaptchaToken(params.captchaToken, params.ip ?? undefined);
  return { required: true, valid };
}

export async function getCurrentSession(refreshToken?: string | undefined) {
  if (!refreshToken) return null;

  return prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) }
  });
}
