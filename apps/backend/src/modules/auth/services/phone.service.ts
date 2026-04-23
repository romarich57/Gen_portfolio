import { AuthAttemptType, UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { recordAuthAttempt } from '../../../services/authAttempts';
import { getOtpRateLimits } from '../../../services/settings';
import { createSession } from '../../../services/session';
import { checkPhoneVerification, startPhoneVerification } from '../../../services/twilio';
import { normalizePhoneE164 } from '../../../utils/phone';
import { enforceCaptchaIfNeeded, resolveDefaultCountry } from '../shared/service-helpers';

type PhoneInput = {
  phoneE164: string;
  country?: string | undefined;
};

type PhoneMeta = {
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  acceptLanguage?: string | undefined;
};

export async function startPhoneVerificationForUser(
  userId: string,
  input: PhoneInput,
  captchaToken: string | undefined,
  meta: PhoneMeta,
  requestId: string
) {
  const defaultCountry = await resolveDefaultCountry(userId, input.country, meta.acceptLanguage);
  const normalizedPhone = normalizePhoneE164(input.phoneE164, {
    defaultCountry: defaultCountry ?? null
  });
  if (!normalizedPhone) {
    throw new Error('VALIDATION_ERROR');
  }

  const phoneE164 = normalizedPhone.normalized;
  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.phone_start,
    email: null,
    ip: meta.ip ?? null,
    captchaToken
  });
  if (captchaCheck.required && !captchaCheck.valid) {
    throw new Error('CAPTCHA_REQUIRED');
  }

  await prisma.phoneVerification.updateMany({
    where: { userId, phoneE164, status: 'pending' },
    data: { status: 'expired' }
  });

  let verification;
  try {
    verification = await startPhoneVerification(phoneE164);
  } catch {
    await recordAuthAttempt({
      type: AuthAttemptType.phone_start,
      email: null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId
    });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip ?? null,
      action: 'PHONE_VERIFY_FAILED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164, reason: 'PROVIDER_ERROR' },
      requestId
    });
    throw new Error('PHONE_VERIFY_FAILED');
  }

  await prisma.phoneVerification.create({
    data: {
      userId,
      phoneE164,
      providerSid: verification.sid,
      status: 'pending',
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  await recordAuthAttempt({
    type: AuthAttemptType.phone_start,
    email: null,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    success: true,
    userId
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: meta.ip ?? null,
    action: 'PHONE_VERIFY_START',
    targetType: 'user',
    targetId: userId,
    metadata: { phone: phoneE164 },
    requestId
  });
}

export async function confirmPhoneVerificationForUser(
  userId: string,
  input: PhoneInput & { code: string },
  captchaToken: string | undefined,
  meta: PhoneMeta,
  requestId: string
) {
  const defaultCountry = await resolveDefaultCountry(userId, input.country, meta.acceptLanguage);
  const normalizedPhone = normalizePhoneE164(input.phoneE164, {
    defaultCountry: defaultCountry ?? null
  });
  if (!normalizedPhone) {
    throw new Error('VALIDATION_ERROR');
  }

  const phoneE164 = normalizedPhone.normalized;
  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.phone_check,
    email: null,
    ip: meta.ip ?? null,
    captchaToken
  });
  if (captchaCheck.required && !captchaCheck.valid) {
    throw new Error('CAPTCHA_REQUIRED');
  }

  const limits = await getOtpRateLimits();
  const maxAttempts = limits.phoneCheck.maxAttempts;
  const existingVerification = await prisma.phoneVerification.findFirst({
    where: { userId, phoneE164, status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });

  if (!existingVerification) {
    throw new Error('PHONE_VERIFY_NOT_STARTED');
  }
  if (existingVerification.expiresAt < new Date()) {
    await prisma.phoneVerification.update({
      where: { id: existingVerification.id },
      data: { status: 'expired' }
    });
    throw new Error('PHONE_VERIFY_EXPIRED');
  }
  if (existingVerification.attempts >= maxAttempts) {
    await prisma.phoneVerification.update({
      where: { id: existingVerification.id },
      data: { status: 'denied' }
    });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip ?? null,
      action: 'PHONE_VERIFY_LOCKED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164 },
      requestId
    });
    throw new Error('PHONE_VERIFY_LOCKED');
  }

  let verification;
  try {
    verification = await checkPhoneVerification(phoneE164, input.code);
  } catch {
    await recordAuthAttempt({
      type: AuthAttemptType.phone_check,
      email: null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId
    });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip ?? null,
      action: 'PHONE_VERIFY_FAILED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164, reason: 'PROVIDER_ERROR' },
      requestId
    });
    throw new Error('PHONE_VERIFY_FAILED_PROVIDER');
  }

  const nextAttempts = existingVerification.attempts + 1;
  if (verification.status !== 'approved') {
    const locked = nextAttempts >= maxAttempts;
    await prisma.phoneVerification.update({
      where: { id: existingVerification.id },
      data: { status: locked ? 'denied' : 'pending', attempts: nextAttempts }
    });

    await recordAuthAttempt({
      type: AuthAttemptType.phone_check,
      email: null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId
    });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip ?? null,
      action: locked ? 'PHONE_VERIFY_LOCKED' : 'PHONE_VERIFY_FAILED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164 },
      requestId
    });

    throw new Error(locked ? 'PHONE_VERIFY_LOCKED' : 'PHONE_VERIFY_FAILED');
  }

  await prisma.phoneVerification.update({
    where: { id: existingVerification.id },
    data: { status: 'approved', attempts: nextAttempts }
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      phoneVerifiedAt: new Date(),
      status: UserStatus.active
    }
  });

  await recordAuthAttempt({
    type: AuthAttemptType.phone_check,
    email: null,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    success: true,
    userId
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: meta.ip ?? null,
    action: 'PHONE_VERIFIED',
    targetType: 'user',
    targetId: userId,
    metadata: { phone: phoneE164 },
    requestId
  });

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

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}
