import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import { sendEmail, buildEmailHtml, buildEmailText, buildEmailVerificationLink } from '../../../services/email';
import { generateRandomToken, hashToken } from '../../../utils/crypto';
import { hashPassword } from '../../../utils/password';
import { normalizeEmail, normalizeUsername } from '../../../utils/normalize';

type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  nationality: string;
};

type RequestMeta = {
  ip?: string | null | undefined;
};

export async function registerUser(input: RegisterInput, meta: RequestMeta, requestId: string) {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);

  await writeAuditLog({
    actorUserId: null,
    actorIp: meta.ip ?? null,
    action: 'REGISTER_ATTEMPT',
    targetType: 'user',
    targetId: null,
    metadata: { email },
    requestId
  });

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  if (existing) {
    await writeAuditLog({
      actorUserId: existing.id,
      actorIp: meta.ip ?? null,
      action: 'REGISTER_ALREADY_EXISTS',
      targetType: 'user',
      targetId: existing.id,
      metadata: { email },
      requestId
    });

    return { message: 'If the account exists, a verification email has been sent.' };
  }

  const existingUsername = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } }
  });
  if (existingUsername) {
    await writeAuditLog({
      actorUserId: existingUsername.id,
      actorIp: meta.ip ?? null,
      action: 'REGISTER_USERNAME_CONFLICT',
      targetType: 'user',
      targetId: existingUsername.id,
      metadata: { email },
      requestId
    });

    return { message: 'If the account exists, a verification email has been sent.' };
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        status: UserStatus.pending_email,
        roles: ['user'],
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        username,
        nationality: input.nationality.toUpperCase(),
        onboardingCompletedAt: new Date()
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { message: 'If the account exists, a verification email has been sent.' };
    }

    throw error;
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
  const emailTemplate = {
    title: 'Verifiez votre email',
    preview: 'Confirmez votre adresse pour activer votre compte.',
    intro: 'Merci pour votre inscription. Cliquez sur le bouton ci-dessous pour verifier votre adresse email.',
    actionLabel: 'Verifier mon email',
    actionUrl: verifyLink,
    outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
  };

  let emailSent = true;
  try {
    await sendEmail({
      to: email,
      subject: 'Verification de votre email',
      text: buildEmailText(emailTemplate),
      html: buildEmailHtml(emailTemplate)
    });
  } catch {
    emailSent = false;
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip ?? null,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: user.id,
      metadata: { reason: 'REGISTER_VERIFY_EMAIL' },
      requestId
    });
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip ?? null,
    action: 'REGISTER_SUCCESS',
    targetType: 'user',
    targetId: user.id,
    metadata: { email },
    requestId
  });

  return {
    message: 'If the account exists, a verification email has been sent.',
    ...(env.isTest ? { testToken: rawToken, emailSent } : {}),
    ...(!env.isProduction ? { emailSent } : {})
  };
}
