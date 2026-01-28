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
