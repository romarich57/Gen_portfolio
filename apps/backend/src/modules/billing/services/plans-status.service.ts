import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import {
  CheckoutError,
  getBillingStatus,
  getPlans,
  syncCheckoutSession
} from '../../../services/billing';

export async function listPlans() {
  return getPlans();
}

export async function getUserBillingStatus(userId: string) {
  return getBillingStatus(userId);
}

export async function syncUserCheckoutSession(params: {
  sessionId: string;
  userId: string;
  actorIp?: string | null | undefined;
  requestId: string;
}) {
  const result = await syncCheckoutSession({ sessionId: params.sessionId, userId: params.userId });

  await writeAuditLog({
    actorUserId: params.userId,
    actorIp: params.actorIp ?? null,
    action: 'BILLING_SYNC',
    targetType: 'subscription',
    targetId: params.sessionId,
    metadata: { plan_code: (result as { plan_code?: string }).plan_code },
    requestId: params.requestId
  });

  return result;
}

export function mapCheckoutError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'CHECKOUT_FAILED';
  const allowedErrors = new Set([
    'SESSION_INVALID',
    'CHECKOUT_FORBIDDEN',
    'SUBSCRIPTION_INVALID',
    'PLAN_NOT_CONFIGURED',
    'STRIPE_ERROR',
    'CHECKOUT_FAILED'
  ]);

  return {
    errorMessage,
    errorCode: allowedErrors.has(errorMessage) ? errorMessage : 'CHECKOUT_FAILED',
    debug: !env.isProduction && error instanceof CheckoutError && error.details ? { ...error.details } : undefined
  };
}
