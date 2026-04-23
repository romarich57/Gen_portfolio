import { AuthAttemptType } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { countRecentFailures } from '../../../services/authAttempts';
import { verifyCaptchaToken } from '../../../services/captcha';

export async function loadBillingUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }
  return user;
}

export async function enforceCheckoutCaptcha(params: {
  email: string;
  ip?: string | null | undefined;
  captchaToken?: string | undefined;
}) {
  const failures = await countRecentFailures({
    type: AuthAttemptType.billing_checkout,
    email: params.email,
    ip: params.ip ?? null,
    windowMinutes: 10
  });

  if (failures < 3) return { required: false, valid: true };
  const valid = await verifyCaptchaToken(params.captchaToken, params.ip ?? undefined);
  return { required: true, valid };
}
