import { AuthAttemptType } from '@prisma/client';
import { writeAuditLog } from '../../../services/audit';
import { createPortalSession, createCheckoutSession, changePlan, CheckoutError } from '../../../services/billing';
import { recordAuthAttempt } from '../../../services/authAttempts';
import { loadBillingUser, enforceCheckoutCaptcha } from '../shared/service-helpers';

type RequestMeta = {
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  requestId: string;
};

export async function createUserCheckoutSession(params: {
  userId: string;
  planCode: 'FREE' | 'PREMIUM' | 'VIP';
  captchaToken?: string | undefined;
  meta: RequestMeta;
}) {
  const user = await loadBillingUser(params.userId);
  const captchaCheck = await enforceCheckoutCaptcha({
    email: user.email,
    ip: params.meta.ip ?? null,
    captchaToken: params.captchaToken
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    await recordAuthAttempt({
      type: AuthAttemptType.billing_checkout,
      email: user.email,
      ip: params.meta.ip ?? null,
      userAgent: params.meta.userAgent ?? null,
      success: false,
      userId: params.userId
    });
    throw new Error('CAPTCHA_REQUIRED');
  }

  const session = await createCheckoutSession({
    userId: params.userId,
    userEmail: user.email,
    planCode: params.planCode
  });

  await recordAuthAttempt({
    type: AuthAttemptType.billing_checkout,
    email: user.email,
    ip: params.meta.ip ?? null,
    userAgent: params.meta.userAgent ?? null,
    success: true,
    userId: params.userId
  });

  await writeAuditLog({
    actorUserId: params.userId,
    actorIp: params.meta.ip ?? null,
    action: 'BILLING_CHECKOUT_CREATED',
    targetType: 'plan',
    targetId: params.planCode,
    metadata: {},
    requestId: params.meta.requestId
  });

  return session.url;
}

export async function changeUserPlan(params: {
  userId: string;
  planCode: 'FREE' | 'PREMIUM' | 'VIP';
  meta: RequestMeta;
}) {
  const user = await loadBillingUser(params.userId);
  const result = await changePlan({
    userId: params.userId,
    userEmail: user.email,
    targetPlanCode: params.planCode
  });

  await writeAuditLog({
    actorUserId: params.userId,
    actorIp: params.meta.ip ?? null,
    action: 'BILLING_PLAN_CHANGE',
    targetType: 'subscription',
    targetId: result.changeType,
    metadata: {
      target_plan: params.planCode,
      change_type: result.changeType
    },
    requestId: params.meta.requestId
  });

  return result;
}

export async function createUserPortalSession(params: {
  userId: string;
  actorIp?: string | null | undefined;
  requestId: string;
}) {
  await loadBillingUser(params.userId);
  const session = await createPortalSession({ userId: params.userId });
  await writeAuditLog({
    actorUserId: params.userId,
    actorIp: params.actorIp ?? null,
    action: 'BILLING_PORTAL_OPENED',
    targetType: 'user',
    targetId: params.userId,
    metadata: {},
    requestId: params.requestId
  });

  return session.url;
}

export function mapBillingActionError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'CHECKOUT_FAILED';
  const allowedErrors = new Set([
    'PLAN_INVALID',
    'PLAN_NOT_CONFIGURED',
    'STRIPE_TAX_NOT_ENABLED',
    'STRIPE_ADDRESS_REQUIRED',
    'SUBSCRIPTION_INVALID',
    'STRIPE_ERROR',
    'CHECKOUT_URL_MISSING',
    'CHECKOUT_FAILED'
  ]);

  return {
    errorMessage,
    errorCode: allowedErrors.has(errorMessage) ? errorMessage : 'CHECKOUT_FAILED',
    debug: error instanceof CheckoutError && error.details ? { ...error.details } : undefined
  };
}
