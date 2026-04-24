import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { sendEmail, buildEmailHtml, buildEmailText } from '../../../services/email';
import {
  sendEmailChangeRequestNotifications,
  sendPasswordChangedNotification,
  sendRecoveryEmailAddedNotification,
  sendRecoveryEmailRemovedNotification
} from '../../../services/accountChangeNotifications';
import { revokeAllSessions } from '../../../services/session';
import { normalizeEmail } from '../../../utils/normalize';
import { verifyPassword, hashPassword } from '../../../utils/password';
import { hashToken, generateRandomToken, hashBackupCode, generateBackupCode } from '../../../utils/crypto';
import { hasRecentMfaIfEnabled } from '../shared/service-helpers';

export async function regenerateBackupCodesForUser(userId: string) {
  const hasRecentMfa = await hasRecentMfaIfEnabled(userId);
  if (!hasRecentMfa) {
    throw new Error('MFA_STEP_UP_REQUIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled) {
    throw new Error('MFA_NOT_CONFIGURED');
  }

  const backupCodes = Array.from({ length: 8 }, () => generateBackupCode());
  const backupCodeHashes = backupCodes.map((codeValue) => ({
    userId,
    codeHash: hashBackupCode(codeValue)
  }));

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({ data: backupCodeHashes })
  ]);

  return backupCodes;
}

export async function updateSecurityAlertsForUser(params: {
  userId: string;
  email_enabled: boolean;
  sms_enabled: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (params.sms_enabled && !user.phoneVerifiedAt) {
    throw new Error('PHONE_NOT_VERIFIED');
  }

  if (params.sms_enabled && !env.twilioMessagingServiceSid && !env.twilioSmsFrom) {
    throw new Error('SMS_NOT_AVAILABLE');
  }

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      securityAlertEmailEnabled: params.email_enabled,
      securityAlertSmsEnabled: params.sms_enabled
    }
  });
}

export async function requestRecoveryEmailForUser(params: {
  userId: string;
  email: string;
  password?: string | undefined;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.passwordHash) {
    if (!params.password) {
      throw new Error('PASSWORD_REQUIRED');
    }
    const valid = await verifyPassword(user.passwordHash, params.password);
    if (!valid) {
      throw new Error('INVALID_PASSWORD');
    }
  }

  const hasRecentMfa = await hasRecentMfaIfEnabled(params.userId);
  if (!hasRecentMfa) {
    throw new Error('MFA_STEP_UP_REQUIRED');
  }

  const recoveryEmail = normalizeEmail(params.email);
  const existingRecovery = await prisma.user.findFirst({
    where: {
      recoveryEmail,
      id: { not: params.userId }
    },
    select: { id: true }
  });

  if (existingRecovery) {
    throw new Error('RECOVERY_EMAIL_TAKEN');
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.recoveryEmailToken.deleteMany({ where: { userId: params.userId } }),
    prisma.recoveryEmailToken.create({
      data: {
        userId: params.userId,
        email: recoveryEmail,
        tokenHash,
        expiresAt
      }
    }),
    prisma.user.update({
      where: { id: params.userId },
      data: { recoveryEmailPending: recoveryEmail }
    })
  ]);

  const verifyLink = `${env.appBaseUrl}/verify-recovery-email?token=${encodeURIComponent(rawToken)}`;
  let emailSent = true;

  try {
    await sendEmail({
      to: recoveryEmail,
      subject: 'Validation de votre email de recuperation',
      html: buildEmailHtml({
        title: 'Validation de votre email de recuperation',
        preview: 'Confirmez votre email de recuperation.',
        intro: 'Vous avez demande a ajouter un email de recuperation.',
        actionLabel: 'Confirmer mon email',
        actionUrl: verifyLink,
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      }),
      text: buildEmailText({
        title: 'Validation de votre email de recuperation',
        preview: 'Confirmez votre email de recuperation.',
        intro: 'Vous avez demande a ajouter un email de recuperation.',
        actionLabel: 'Confirmer mon email',
        actionUrl: verifyLink,
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      })
    });
  } catch {
    emailSent = false;
  }

  await sendRecoveryEmailAddedNotification({
    email: user.email,
    recoveryEmail
  }).catch(() => undefined);

  return { emailSent, rawToken };
}

export async function removeRecoveryEmailForUser(params: {
  userId: string;
  password?: string | undefined;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.passwordHash) {
    if (!params.password) {
      throw new Error('PASSWORD_REQUIRED');
    }
    const valid = await verifyPassword(user.passwordHash, params.password);
    if (!valid) {
      throw new Error('INVALID_PASSWORD');
    }
  }

  const hasRecentMfa = await hasRecentMfaIfEnabled(params.userId);
  if (!hasRecentMfa) {
    throw new Error('MFA_STEP_UP_REQUIRED');
  }

  await prisma.$transaction([
    prisma.recoveryEmailToken.deleteMany({ where: { userId: params.userId } }),
    prisma.user.update({
      where: { id: params.userId },
      data: {
        recoveryEmail: null,
        recoveryEmailVerifiedAt: null,
        recoveryEmailPending: null
      }
    })
  ]);

  await sendRecoveryEmailRemovedNotification(user.email).catch(() => undefined);
}

export async function changePasswordForUser(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (!user.passwordHash) {
    throw new Error('NO_PASSWORD_SET');
  }

  const valid = await verifyPassword(user.passwordHash, params.currentPassword);
  if (!valid) {
    throw new Error('INVALID_PASSWORD');
  }

  const newHash = await hashPassword(params.newPassword);
  await prisma.user.update({
    where: { id: params.userId },
    data: { passwordHash: newHash }
  });

  await revokeAllSessions(params.userId);
  await sendPasswordChangedNotification(user.email).catch(() => undefined);
}

async function requireRecentMfaForSensitiveEmailChange(userId: string) {
  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null } },
    orderBy: { lastUsedAt: 'desc' }
  });

  if (!factor || !factor.lastUsedAt) {
    throw new Error('MFA_STEP_UP_REQUIRED');
  }

  const maxAgeMs = env.reauthMaxHours * 60 * 60 * 1000;
  if (Date.now() - factor.lastUsedAt.getTime() > maxAgeMs) {
    throw new Error('MFA_STEP_UP_REQUIRED');
  }
}

export async function requestEmailChangeForUser(params: {
  userId: string;
  newEmail: string;
  password?: string | undefined;
  requestedIp?: string | null | undefined;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  await requireRecentMfaForSensitiveEmailChange(params.userId);

  if (user.passwordHash) {
    if (!params.password) {
      throw new Error('PASSWORD_REQUIRED');
    }
    const valid = await verifyPassword(user.passwordHash, params.password);
    if (!valid) {
      throw new Error('INVALID_PASSWORD');
    }
  }

  const normalizedEmail = normalizeEmail(params.newEmail);
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      id: { not: params.userId }
    }
  });
  if (existing) {
    throw new Error('EMAIL_UNAVAILABLE');
  }

  const verifyToken = generateRandomToken(32);
  const cancelToken = generateRandomToken(32);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const request = await prisma.$transaction(async (tx) => {
    await tx.emailChangeRequest.deleteMany({
      where: {
        userId: params.userId,
        completedAt: null,
        cancelledAt: null
      }
    });

    return tx.emailChangeRequest.create({
      data: {
        userId: params.userId,
        oldEmail: user.email,
        newEmail: normalizedEmail,
        verifyTokenHash: hashToken(verifyToken),
        cancelTokenHash: hashToken(cancelToken),
        requestedIp: params.requestedIp ?? null,
        expiresAt
      }
    });
  });

  const verifyLink = `${env.appBaseUrl}/verify-email-change?token=${encodeURIComponent(verifyToken)}`;
  const cancelLink = `${env.appBaseUrl}/cancel-email-change?token=${encodeURIComponent(cancelToken)}`;

  try {
    await sendEmailChangeRequestNotifications({
      oldEmail: user.email,
      newEmail: normalizedEmail,
      verifyUrl: verifyLink,
      cancelUrl: cancelLink
    });
  } catch (error) {
    await prisma.emailChangeRequest.delete({ where: { id: request.id } });
    throw error;
  }

  return { normalizedEmail, verifyToken, cancelToken };
}
