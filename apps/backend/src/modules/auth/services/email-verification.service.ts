import { UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import { sendEmail, buildEmailHtml, buildEmailText, buildEmailVerificationLink } from '../../../services/email';
import { generateRandomToken, hashToken } from '../../../utils/crypto';
import {
  signActionConfirmationToken,
  verifyActionConfirmationToken,
  verifyEmailChangeToken
} from '../../../utils/jwt';
import { normalizeEmail } from '../../../utils/normalize';

type EmailActionMeta = {
  ip?: string | null | undefined;
};

export async function resendVerificationEmail(emailInput: string, meta: EmailActionMeta, requestId: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });

  if (!user || user.emailVerifiedAt) {
    return { message: 'If the account exists, a verification email has been sent.' };
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const verifyLink = buildEmailVerificationLink(rawToken);
  const resendTemplate = {
    title: 'Verifier votre email',
    preview: 'Confirmez votre adresse pour activer votre compte.',
    intro: 'Voici votre nouveau lien de verification. Cliquez ci-dessous pour finaliser votre inscription.',
    actionLabel: 'Verifier mon email',
    actionUrl: verifyLink,
    outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
  };

  let resendSent = true;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verification de votre email',
      text: buildEmailText(resendTemplate),
      html: buildEmailHtml(resendTemplate)
    });
  } catch {
    resendSent = false;
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: user.id,
      metadata: { reason: 'EMAIL_RESEND' },
      requestId
    });
  }

  if (resendSent) {
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'EMAIL_VERIFICATION_RESEND',
      targetType: 'user',
      targetId: user.id,
      metadata: {},
      requestId
    });
  }

  return {
    message: 'If the account exists, a verification email has been sent.',
    ...(env.isTest ? { testToken: rawToken, emailSent: resendSent } : {}),
    ...(!env.isProduction ? { emailSent: resendSent } : {})
  };
}

export async function createEmailVerificationConfirmation(token: string, requestId: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error('TOKEN_INVALID');
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: 'email_verify',
      sourceTokenHash: tokenHash
    },
    5
  );

  return { confirmationToken, requestId };
}

export async function confirmEmailVerification(confirmationToken: string, meta: EmailActionMeta, requestId: string) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'email_verify') {
    throw new Error('TOKEN_INVALID');
  }

  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: payload.sourceTokenHash } });
  if (!record || record.userId !== payload.sub || record.usedAt || record.expiresAt < new Date()) {
    throw new Error('TOKEN_INVALID');
  }

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: {
      emailVerifiedAt: new Date(),
      status: UserStatus.active
    }
  });

  await prisma.emailVerificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip ?? null,
    action: 'EMAIL_VERIFIED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId
  });
}

export async function createRecoveryEmailConfirmation(token: string, requestId: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.recoveryEmailToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error('TOKEN_INVALID');
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: 'recovery_email_verify',
      sourceTokenHash: tokenHash
    },
    5
  );

  return { confirmationToken, requestId };
}

export async function confirmRecoveryEmail(confirmationToken: string, meta: EmailActionMeta, requestId: string) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'recovery_email_verify') {
    throw new Error('TOKEN_INVALID');
  }

  const record = await prisma.recoveryEmailToken.findUnique({ where: { tokenHash: payload.sourceTokenHash } });
  if (!record || record.userId !== payload.sub || record.usedAt || record.expiresAt < new Date()) {
    throw new Error('TOKEN_INVALID');
  }

  await prisma.$transaction([
    prisma.recoveryEmailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        recoveryEmail: record.email,
        recoveryEmailVerifiedAt: new Date(),
        recoveryEmailPending: null
      }
    })
  ]);

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: meta.ip ?? null,
    action: 'RECOVERY_EMAIL_VERIFIED',
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId
  });
}

export async function createEmailChangeConfirmation(token: string, requestId: string) {
  try {
    const payload = verifyEmailChangeToken(token);
    if (payload.type !== 'email_change' || !payload.newEmail) {
      throw new Error('TOKEN_INVALID');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const existing = await prisma.user.findUnique({ where: { email: payload.newEmail } });
    if (existing) {
      throw new Error('EMAIL_UNAVAILABLE');
    }

    const confirmationToken = signActionConfirmationToken(
      {
        sub: payload.sub,
        type: 'action_confirmation',
        action: 'email_change_verify',
        sourceTokenHash: hashToken(token),
        newEmail: payload.newEmail
      },
      5
    );

    return { confirmationToken, requestId };
  } catch (error) {
    if (error instanceof Error && ['USER_NOT_FOUND', 'EMAIL_UNAVAILABLE'].includes(error.message)) {
      throw error;
    }
    throw new Error('TOKEN_EXPIRED');
  }
}

export async function confirmEmailChange(confirmationToken: string, meta: EmailActionMeta, requestId: string) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'email_change_verify' || !payload.newEmail) {
    throw new Error('TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const existing = await prisma.user.findUnique({ where: { email: payload.newEmail } });
  if (existing) {
    throw new Error('EMAIL_UNAVAILABLE');
  }

  await prisma.user.update({
    where: { id: payload.sub },
    data: {
      email: payload.newEmail,
      emailVerifiedAt: new Date()
    }
  });

  await writeAuditLog({
    actorUserId: payload.sub,
    actorIp: meta.ip ?? null,
    action: 'EMAIL_CHANGED',
    targetType: 'user',
    targetId: payload.sub,
    metadata: { new_email: payload.newEmail },
    requestId
  });
}
