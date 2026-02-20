import { apiRequest } from './http';
import { API_BASE_URL } from './config';
import { fetchCsrfToken, getCsrfToken } from './csrf';

export type LoginResult = { ok: true } | { error: string };

type ActionBootstrapResponse = {
  confirmation_token: string;
};

async function ensureCsrfToken() {
  if (getCsrfToken()) return;
  await fetchCsrfToken();
}

async function confirmBootstrapAction(
  bootstrapPath: string,
  confirmPath: string,
  token: string,
  skipAuthRedirect = true
) {
  const query = new URLSearchParams({ token });
  const bootstrap = await apiRequest<ActionBootstrapResponse>(`${bootstrapPath}?${query.toString()}`, {
    method: 'GET',
    skipAuthRedirect
  });

  await ensureCsrfToken();

  return apiRequest<{ ok?: boolean }>(confirmPath, {
    method: 'POST',
    body: JSON.stringify({ confirmation_token: bootstrap.confirmation_token }),
    skipAuthRedirect
  });
}

/**
 * Register a new user.
 * Preconditions: email/password validated client-side.
 * Postconditions: backend sends verification email.
 */
export async function register(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  nationality: string;
  captchaToken?: string;
}) {
  return apiRequest<{ ok?: boolean; email_sent?: boolean }>(`/auth/register`, {
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
  return confirmBootstrapAction('/auth/email/verify', '/auth/email/verify', token, true);
}

/**
 * Authenticate with email and password.
 * Preconditions: CSRF token fetched.
 * Postconditions: cookies set or MFA challenge required.
 */
export async function login(params: { identifier: string; password: string }) {
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
  return apiRequest<{ ok?: boolean; email_sent?: boolean }>(`/auth/email/resend`, {
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
export async function startPhoneVerify(params: { phoneE164: string; country?: string }) {
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
export async function checkPhoneVerify(params: { phoneE164: string; code: string; country?: string }) {
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

/**
 * Unlink OAuth provider from account.
 * Preconditions: has password or other OAuth provider.
 * Postconditions: provider unlinked.
 */
export async function unlinkOAuth(provider: 'google' | 'github') {
  return apiRequest<{ ok: boolean }>(`/auth/oauth/${provider}`, {
    method: 'DELETE'
  });
}

/**
 * Set password for OAuth-only users.
 * Preconditions: user has no password yet.
 * Postconditions: password set.
 */
export async function setPassword(params: { password: string; password_confirmation: string }) {
  return apiRequest<{ ok: boolean }>(`/auth/set-password`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Verify email change token.
 */
export async function verifyEmailChange(token: string) {
  return confirmBootstrapAction('/auth/email/change/verify', '/auth/email/change/verify', token, true);
}

/**
 * Verify recovery email token.
 */
export async function verifyRecoveryEmail(token: string) {
  return confirmBootstrapAction('/auth/recovery-email/verify', '/auth/recovery-email/verify', token, true);
}

/**
 * Revoke all sessions via security alert token.
 */
export async function revokeSessionsFromAlert(token: string) {
  return confirmBootstrapAction('/auth/security/revoke-sessions', '/auth/security/revoke-sessions', token, true);
}

/**
 * Acknowledge security alert (\"C'etait moi\").
 */
export async function acknowledgeSecurityAlert(token: string) {
  return confirmBootstrapAction('/auth/security/acknowledge-alert', '/auth/security/acknowledge-alert', token, true);
}
