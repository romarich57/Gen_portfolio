import { UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { verifyCaptchaToken } from '../../../services/captcha';
import { generateTotpSecret, verifyTotpCode } from '../../../services/mfa';
import { getMfaProtectionState, recordMfaFailure, clearMfaFailures } from '../../../services/mfaProtection';
import { createSession } from '../../../services/session';
import { maybeSendLoginAlert } from '../../../services/securityAlerts';
import { decryptSecret, encryptSecret, generateBackupCode, hashBackupCode } from '../../../utils/crypto';
import { hasKnownDeviceSession } from '../shared/service-helpers';

type MfaMeta = {
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

export async function startMfaSetup(userId: string, ip: string | null, requestId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const { secret, otpauthUrl } = generateTotpSecret(user.email);
  const encrypted = encryptSecret(secret);

  await prisma.mfaFactor.deleteMany({
    where: { userId: user.id, enabledAt: null }
  });

  await prisma.mfaFactor.create({
    data: {
      userId: user.id,
      type: 'totp',
      secretEncrypted: encrypted
    }
  });

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: ip,
    action: 'MFA_SETUP_START',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId
  });

  return { otpauthUrl };
}

export async function confirmMfaSetup(
  userId: string,
  code: string,
  captchaToken: string | undefined,
  meta: MfaMeta,
  requestId: string
) {
  const protectionState = await getMfaProtectionState('setup_confirm', userId);
  if (protectionState.locked) {
    throw new Error(`MFA_TEMP_LOCKED:${protectionState.retryAfterSeconds}`);
  }

  if (protectionState.captchaRequired) {
    const captchaValid = Boolean(captchaToken) && (await verifyCaptchaToken(captchaToken, meta.ip ?? undefined));
    if (!captchaValid) {
      throw new Error('CAPTCHA_REQUIRED');
    }
  }

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, enabledAt: null },
    orderBy: { createdAt: 'desc' }
  });
  if (!factor) {
    throw new Error('MFA_SETUP_REQUIRED');
  }

  const secret = decryptSecret(factor.secretEncrypted);
  if (!verifyTotpCode(code, secret)) {
    const failureState = await recordMfaFailure('setup_confirm', userId);
    if (failureState.locked) {
      throw new Error(`MFA_TEMP_LOCKED:${failureState.retryAfterSeconds}`);
    }
    throw new Error('MFA_CODE_INVALID');
  }

  await clearMfaFailures('setup_confirm', userId);

  const backupCodes = Array.from({ length: 8 }, () => generateBackupCode());
  const backupCodeHashes = backupCodes.map((backupCode) => ({
    userId,
    codeHash: hashBackupCode(backupCode)
  }));

  await prisma.$transaction([
    prisma.mfaFactor.update({
      where: { id: factor.id },
      data: { enabledAt: new Date(), lastUsedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, status: UserStatus.active }
    }),
    prisma.backupCode.createMany({ data: backupCodeHashes })
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const session = await createSession({
    userId: user.id,
    roles: user.roles as unknown as string[],
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null
  });

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip ?? null,
    action: 'MFA_ENABLED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId
  });

  return {
    backupCodes,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}

export async function verifyMfaChallenge(
  userId: string,
  code: string,
  captchaToken: string | undefined,
  meta: MfaMeta,
  requestId: string
) {
  const protectionState = await getMfaProtectionState('verify', userId);
  if (protectionState.locked) {
    throw new Error(`MFA_TEMP_LOCKED:${protectionState.retryAfterSeconds}`);
  }

  if (protectionState.captchaRequired) {
    const captchaValid = Boolean(captchaToken) && (await verifyCaptchaToken(captchaToken, meta.ip ?? undefined));
    if (!captchaValid) {
      throw new Error('CAPTCHA_REQUIRED');
    }
  }

  const normalizedCode = code.trim();
  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null } },
    orderBy: { createdAt: 'desc' }
  });
  if (!factor) {
    throw new Error('MFA_NOT_CONFIGURED');
  }

  const secret = decryptSecret(factor.secretEncrypted);
  const valid = /^\d{6,8}$/.test(normalizedCode) ? verifyTotpCode(normalizedCode, secret) : false;
  if (!valid) {
    const isBackupCodeFormat = /^[A-Za-z0-9_-]{11}$/.test(normalizedCode);
    let backup = null as Awaited<ReturnType<typeof prisma.backupCode.findFirst>>;
    if (isBackupCodeFormat) {
      const backupHash = hashBackupCode(normalizedCode);
      backup = await prisma.backupCode.findFirst({
        where: { userId, codeHash: backupHash, usedAt: null }
      });
    }

    if (!backup) {
      const failureState = await recordMfaFailure('verify', userId);
      await writeAuditLog({
        actorUserId: userId,
        actorIp: meta.ip ?? null,
        action: 'MFA_CHALLENGE_FAIL',
        targetType: 'user',
        targetId: userId,
        metadata: { lockout: failureState.locked },
        requestId
      });
      if (failureState.locked) {
        throw new Error(`MFA_TEMP_LOCKED:${failureState.retryAfterSeconds}`);
      }
      throw new Error('MFA_CODE_INVALID');
    }

    await prisma.backupCode.update({
      where: { id: backup.id },
      data: { usedAt: new Date() }
    });
  }

  await clearMfaFailures('verify', userId);
  await prisma.mfaFactor.update({
    where: { id: factor.id },
    data: { lastUsedAt: new Date() }
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
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
    action: 'MFA_CHALLENGE_SUCCESS',
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
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}
