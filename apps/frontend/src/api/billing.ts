import { apiRequest } from './http';
import type { BillingStatus } from './types';

/**
 * Fetch billing status for current user.
 * Preconditions: authenticated session.
 * Postconditions: returns plan and entitlements.
 */
export async function getBillingStatus() {
  return apiRequest<BillingStatus>(`/billing/status`, {
    method: 'GET'
  });
}

/**
 * Create Stripe checkout session for plan upgrade.
 * Preconditions: CSRF token fetched.
 * Postconditions: returns checkout_url for redirect.
 */
export async function createCheckoutSession(params: { planCode: 'PREMIUM' | 'VIP' }) {
  return apiRequest<{ checkout_url: string }>(`/billing/checkout-session`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Change plan (upgrade/downgrade/cancel) with Stripe proration handling.
 * Preconditions: authenticated session + CSRF token fetched.
 * Postconditions: may return checkout_url or immediate change.
 */
export async function changePlan(params: { planCode: 'FREE' | 'PREMIUM' | 'VIP' }) {
  return apiRequest<{
    changeType: 'upgrade' | 'downgrade' | 'same' | 'new';
    checkoutUrl?: string;
    effectiveAt?: string | null;
    message: string;
  }>(`/billing/change-plan`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Sync Stripe checkout session after redirect (fallback if webhook delay).
 */
export async function syncCheckoutSession(params: { sessionId: string }) {
  return apiRequest<{ ok: true; plan_code?: string }>(`/billing/sync-session`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Create Stripe customer portal session.
 * Preconditions: CSRF token fetched.
 * Postconditions: returns portal_url for redirect.
 */
export async function createPortalSession() {
  return apiRequest<{ portal_url: string }>(`/billing/portal`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}
