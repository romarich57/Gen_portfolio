import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { buildEmailHtml, buildEmailText, buildPasswordResetLink, sendEmail } from '../../../services/email';
import { enforceCaptchaIfNeeded } from '../shared/service-helpers';
import { AuthAttemptType } from '@prisma/client';
import { generateRandomToken, hashToken } from '../../../utils/crypto';
import { hashPassword } from '../../../utils/password';
import { revokeAllSessions } from '../../../services/session';
import { normalizeEmail } from '../../../utils/normalize';

type PasswordMeta = {
  ip?: string | null | undefined;
};

export async function requestPasswordReset(
  emailInput: string,
  captchaToken: string | undefined,
  meta: PasswordMeta,
  requestId: string
) {
  const email = normalizeEmail(emailInput);
  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.login,
    email,
    ip: meta.ip ?? null,
    captchaToken
  });
  if (captchaCheck.required && !captchaCheck.valid) {
    throw new Error('CAPTCHA_REQUIRED');
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });

  if (!user) {
    await writeAuditLog({
      actorUserId: null,
      actorIp: meta.ip ?? null,
      action: 'RESET_REQUESTED',
      targetType: 'user',
      targetId: null,
      metadata: { email, exists: false },
      requestId
    });
    return;
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const resetLink = buildPasswordResetLink(rawToken);
  const resetTemplate = {
    title: 'Reinitialiser votre mot de passe',
    preview: 'Demande de reinitialisation de mot de passe.',
    intro: 'Nous avons recu une demande de reinitialisation. Cliquez sur le bouton ci-dessous.',
    actionLabel: 'Reinitialiser le mot de passe',
    actionUrl: resetLink,
    outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
  };

  let resetSent = true;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reinitialisation du mot de passe',
      text: buildEmailText(resetTemplate),
      html: buildEmailHtml(resetTemplate)
    });
  } catch {
    resetSent = false;
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: user.id,
      metadata: { reason: 'RESET_REQUEST' },
      requestId
    });
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip ?? null,
    action: 'RESET_REQUESTED',
    targetType: 'user',
    targetId: user.id,
    metadata: { email, exists: true, email_sent: resetSent },
    requestId
  });
}

export async function confirmPasswordReset(token: string, newPassword: string, ip: string | null, requestId: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error('TOKEN_INVALID');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash }
  });

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  await revokeAllSessions(record.userId);

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: ip,
    action: 'PASSWORD_RESET_SUCCESS',
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId
  });
}

export async function setPasswordForOAuthUser(userId: string, password: string, ip: string | null, requestId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  if (user.passwordHash) {
    throw new Error('PASSWORD_ALREADY_SET');
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: ip,
    action: 'PASSWORD_SET',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId
  });
}
