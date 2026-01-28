import { apiRequest } from './http';
import { API_BASE_URL } from './config';

export type LoginResult = { ok: true } | { error: string };

/**
 * Register a new user.
 * Preconditions: email/password validated client-side.
 * Postconditions: backend sends verification email.
 */
export async function register(params: { email: string; password: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/register`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Verify email token.
 * Preconditions: token provided in URL.
 * Postconditions: email verified and onboarding cookie set.
 */
export async function verifyEmail(token: string) {
  const query = new URLSearchParams({ token });
  return apiRequest<{ ok?: boolean }>(`/auth/email/verify?${query.toString()}`, {
    method: 'GET',
    skipAuthRedirect: true
  });
}

/**
 * Authenticate with email and password.
 * Preconditions: CSRF token fetched.
 * Postconditions: cookies set or MFA challenge required.
 */
export async function login(params: { email: string; password: string }) {
  return apiRequest<LoginResult>(`/auth/login`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Logout and revoke current session.
 * Preconditions: none.
 * Postconditions: auth cookies cleared.
 */
export async function logout() {
  return apiRequest<void>(`/auth/logout`, {
    method: 'POST'
  });
}

/**
 * Request a password reset email.
 * Preconditions: email provided.
 * Postconditions: always returns neutral response.
 */
export async function requestPasswordReset(params: { email: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/password/reset/request`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Resend email verification link.
 * Preconditions: email provided.
 * Postconditions: neutral response returned.
 */
export async function resendEmailVerification(params: { email: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/email/resend`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Confirm password reset with token.
 * Preconditions: token and new password provided.
 * Postconditions: password updated and sessions revoked.
 */
export async function confirmPasswordReset(params: { token: string; newPassword: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/password/reset/confirm`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Start phone verification with Twilio.
 * Preconditions: onboarding cookie stage=phone.
 * Postconditions: OTP sent to phone.
 */
export async function startPhoneVerify(params: { phoneE164: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/phone/start`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Check phone verification code.
 * Preconditions: OTP code received by user.
 * Postconditions: onboarding advances.
 */
export async function checkPhoneVerify(params: { phoneE164: string; code: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/phone/check`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Start MFA setup and return otpauth URL.
 * Preconditions: onboarding cookie stage=mfa.
 * Postconditions: pending MFA factor created.
 */
export async function startMfaSetup() {
  return apiRequest<{ otpauthUrl: string }>(`/auth/mfa/setup/start`, {
    method: 'POST',
    body: JSON.stringify({}),
    skipAuthRedirect: true
  });
}

/**
 * Confirm MFA setup with TOTP code.
 * Preconditions: valid TOTP code.
 * Postconditions: MFA enabled, backup codes returned.
 */
export async function confirmMfaSetup(params: { code: string }) {
  return apiRequest<{ backupCodes: string[] }>(`/auth/mfa/setup/confirm`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Verify MFA challenge (TOTP or backup code).
 * Preconditions: MFA challenge cookie set.
 * Postconditions: session established.
 */
export async function verifyMfa(params: { code: string }) {
  return apiRequest<{ ok?: boolean }>(`/auth/mfa/verify`, {
    method: 'POST',
    body: JSON.stringify(params),
    skipAuthRedirect: true
  });
}

/**
 * Start OAuth flow with provider.
 * Preconditions: provider in {google, github}.
 * Postconditions: browser redirected to provider.
 */
export function startOAuth(provider: 'google' | 'github') {
  window.location.assign(`${API_BASE_URL}/auth/oauth/${provider}/start`);
}
