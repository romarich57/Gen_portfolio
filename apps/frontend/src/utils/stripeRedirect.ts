const STRIPE_ALLOWED_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com']);

export type StripeRedirectValidationError = 'INVALID_URL' | 'INVALID_PROTOCOL' | 'UNTRUSTED_HOST';

export type StripeRedirectValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: StripeRedirectValidationError };

export function validateStripeRedirectUrl(rawUrl: string): StripeRedirectValidationResult {
  if (!rawUrl.trim()) {
    return { ok: false, error: 'INVALID_URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'INVALID_PROTOCOL' };
  }

  if (!STRIPE_ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, error: 'UNTRUSTED_HOST' };
  }

  return { ok: true, url: parsed };
}

export function redirectToValidatedStripeUrl(
  rawUrl: string,
  onRedirect: (url: string) => void = (url) => window.location.assign(url)
): StripeRedirectValidationResult {
  const result = validateStripeRedirectUrl(rawUrl);
  if (result.ok) {
    onRedirect(result.url.toString());
  }
  return result;
}
