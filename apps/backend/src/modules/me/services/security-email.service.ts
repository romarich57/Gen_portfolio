import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { sendEmail, buildEmailHtml, buildEmailText } from '../../../services/email';
import { revokeAllSessions } from '../../../services/session';
import { normalizeEmail } from '../../../utils/normalize';
import { verifyPassword, hashPassword } from '../../../utils/password';
import { signEmailChangeToken } from '../../../utils/jwt';
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
}

export async function requestEmailChangeForUser(params: {
  userId: string;
  newEmail: string;
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

  const normalizedEmail = normalizeEmail(params.newEmail);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error('EMAIL_UNAVAILABLE');
  }

  const token = signEmailChangeToken(
    {
      sub: params.userId,
      newEmail: normalizedEmail,
      type: 'email_change'
    },
    60
  );

  const verifyLink = `${env.appBaseUrl}/verify-email-change?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: normalizedEmail,
    subject: 'Vérification de votre nouvel email',
    html: buildEmailHtml({
      title: 'Changement d\'email',
      preview: 'Confirmez votre nouvel email.',
      intro: `Vous avez demandé à changer votre email pour ${normalizedEmail}.`,
      actionLabel: 'Vérifier mon nouvel email',
      actionUrl: verifyLink,
      outro: 'Ce lien expire dans 1 heure.'
    }),
    text: buildEmailText({
      title: 'Changement d\'email',
      preview: 'Confirmez votre nouvel email.',
      intro: `Vous avez demandé à changer votre email pour ${normalizedEmail}.`,
      actionLabel: 'Vérifier mon nouvel email',
      actionUrl: verifyLink,
      outro: 'Ce lien expire dans 1 heure.'
    })
  });

  return { normalizedEmail, token };
}
