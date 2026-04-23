import type { AuthAttemptType } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  buildEmailVerificationLink
} from '../../../services/email';
import { verifyCaptchaToken } from '../../../services/captcha';
import { countRecentFailures } from '../../../services/authAttempts';
import { generateRandomToken, hashToken } from '../../../utils/crypto';
import { normalizeCountryCode, extractCountryFromLocale } from '../../../utils/phone';

export function hashIdentifierForAudit(identifier: string): string {
  return hashToken(identifier.trim().toLowerCase());
}

export async function issueEmailVerification(params: {
  userId: string;
  email: string;
  requestId: string;
  ip?: string | null | undefined;
}) {
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      userId: params.userId,
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
      to: params.email,
      subject: 'Verification de votre email',
      text: buildEmailText(emailTemplate),
      html: buildEmailHtml(emailTemplate)
    });
  } catch {
    emailSent = false;
    await writeAuditLog({
      actorUserId: params.userId,
      actorIp: params.ip ?? null,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: params.userId,
      metadata: { email: params.email, reason: 'OAUTH_VERIFY' },
      requestId: params.requestId
    });
  }

  return { emailSent, rawToken };
}

export async function hasKnownDeviceSession(params: {
  userId: string;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
}) {
  if (!params.ip || !params.userAgent) {
    return false;
  }

  const existingSession = await prisma.session.findFirst({
    where: {
      userId: params.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ip: params.ip,
      userAgent: params.userAgent
    }
  });

  return Boolean(existingSession);
}

export async function enforceCaptchaIfNeeded(params: {
  type: AuthAttemptType;
  email?: string | null | undefined;
  ip?: string | null | undefined;
  captchaToken?: string | undefined;
}) {
  const failures = await countRecentFailures({
    type: params.type,
    email: params.email ?? null,
    ip: params.ip ?? null,
    windowMinutes: 10
  });

  if (failures < 3) return { required: false, valid: true };

  const valid = await verifyCaptchaToken(params.captchaToken, params.ip ?? undefined);
  return { required: true, valid };
}

export async function resolveDefaultCountry(
  userId: string,
  requested?: string | undefined,
  acceptLanguage?: string | undefined
) {
  const requestedCountry = normalizeCountryCode(requested);
  if (requestedCountry) return requestedCountry;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nationality: true, locale: true }
  });

  const nationality = normalizeCountryCode(user?.nationality ?? undefined);
  if (nationality) return nationality;

  const localeCountry = extractCountryFromLocale(user?.locale ?? undefined);
  if (localeCountry) return localeCountry;

  const acceptCountry = extractCountryFromLocale(acceptLanguage);
  if (acceptCountry) return acceptCountry;

  return null;
}
