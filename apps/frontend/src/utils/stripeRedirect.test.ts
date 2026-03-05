import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redirectToValidatedStripeUrl, validateStripeRedirectUrl } from './stripeRedirect';

describe('stripeRedirect', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid Stripe checkout URL', () => {
    const result = validateStripeRedirectUrl('https://checkout.stripe.com/c/pay/cs_test_123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.hostname).toBe('checkout.stripe.com');
    }
  });

  it('accepts a valid Stripe billing URL', () => {
    const result = validateStripeRedirectUrl('https://billing.stripe.com/p/session_123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.hostname).toBe('billing.stripe.com');
    }
  });

  it('rejects non-https protocols', () => {
    const result = validateStripeRedirectUrl('http://checkout.stripe.com/c/pay/cs_test_123');

    expect(result).toEqual({ ok: false, error: 'INVALID_PROTOCOL' });
  });

  it('rejects untrusted hosts', () => {
    const result = validateStripeRedirectUrl('https://evil.example.com/pay/cs_test_123');

    expect(result).toEqual({ ok: false, error: 'UNTRUSTED_HOST' });
  });

  it('rejects malformed URLs', () => {
    const result = validateStripeRedirectUrl('not-a-valid-url');

    expect(result).toEqual({ ok: false, error: 'INVALID_URL' });
  });

  it('redirects only when URL is valid', () => {
    const redirectSpy = vi.fn();

    const valid = redirectToValidatedStripeUrl(
      'https://checkout.stripe.com/c/pay/cs_test_123',
      redirectSpy
    );
    const invalid = redirectToValidatedStripeUrl(
      'https://attacker.example.com/c/pay/cs_test_123',
      redirectSpy
    );

    expect(valid.ok).toBe(true);
    expect(invalid).toEqual({ ok: false, error: 'UNTRUSTED_HOST' });
    expect(redirectSpy).toHaveBeenCalledTimes(1);
    expect(redirectSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_123');
  });
});
