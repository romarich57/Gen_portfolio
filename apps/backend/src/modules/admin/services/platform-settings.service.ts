import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';

export async function upsertAdminFlag(key: string, value: boolean) {
  return prisma.featureFlag.upsert({
    where: { key },
    update: { valueBoolean: value },
    create: { key, valueBoolean: value }
  });
}

export async function getAdminMfaFlags() {
  const [globalFlag, allowDisableFlag] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key: 'mfa_required_global' } }),
    prisma.featureFlag.findUnique({ where: { key: 'allow_disable_mfa' } })
  ]);

  return {
    mfaRequiredGlobal: globalFlag?.valueBoolean ?? false,
    allowDisableMfa: allowDisableFlag?.valueBoolean ?? true
  };
}

export async function updateAdminOtpRateLimits(valueJson: Prisma.InputJsonValue) {
  await prisma.appSetting.upsert({
    where: { key: 'otp_rate_limits' },
    update: { valueJson },
    create: { key: 'otp_rate_limits', valueJson }
  });
}

export async function setUserMfaOverride(userId: string, required: boolean | null) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaRequiredOverride: required }
  });
}
