import { apiRequest } from './http';
import type { OnboardingStatus, UserProfile, SessionInfo, SessionHistoryEntry } from './types';

/**
 * Fetch current user profile.
 * Preconditions: session cookies present.
 * Postconditions: returns profile if authenticated.
 */
export async function getMe() {
  return apiRequest<{ profile: UserProfile }>(`/me`, {
    method: 'GET'
  });
}

/**
 * Fetch onboarding status and missing fields.
 * Preconditions: session cookies present.
 * Postconditions: returns onboarding status.
 */
export async function getOnboardingStatus() {
  return apiRequest<OnboardingStatus>(`/me/onboarding`, {
    method: 'GET'
  });
}

/**
 * Complete onboarding profile.
 * Preconditions: CSRF token fetched.
 * Postconditions: onboarding_completed_at set.
 */
export async function patchOnboarding(params: {
  first_name: string;
  last_name: string;
  username: string;
  nationality: string;
}) {
  return apiRequest<{ ok: boolean }>(`/me/onboarding`, {
    method: 'PATCH',
    body: JSON.stringify(params)
  });
}

/**
 * Update profile fields.
 * Preconditions: CSRF token fetched.
 * Postconditions: profile updated.
 */
export async function patchMe(params: {
  first_name?: string;
  last_name?: string;
  username?: string;
  nationality?: string;
  locale?: string;
}) {
  return apiRequest<{ ok: boolean }>(`/me`, {
    method: 'PATCH',
    body: JSON.stringify(params)
  });
}

/**
 * Request a presigned URL to upload an avatar.
 * Preconditions: CSRF token fetched.
 * Postconditions: returns upload_url and file_id.
 */
export async function requestAvatarUploadUrl(params: {
  content_type: string;
  file_size: number;
}) {
  return apiRequest<{ upload_url: string; file_id: string }>(`/me/avatar/upload-url`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Confirm avatar upload after file has been uploaded to S3.
 * Preconditions: file uploaded to S3.
 * Postconditions: avatar is set on user profile.
 */
export async function confirmAvatarUpload(params: { file_id: string }) {
  return apiRequest<{ ok: boolean }>(`/me/avatar/confirm`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Change current user password.
 */
export async function changePassword(params: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return apiRequest<{ ok: boolean }>(`/me/password`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Request email change.
 */
export async function changeEmail(params: { newEmail: string; password?: string }) {
  return apiRequest<{ ok: boolean }>(`/me/email`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * List active sessions for the current user.
 */
export async function getSessions() {
  return apiRequest<{ sessions: SessionInfo[] }>(`/me/sessions`, {
    method: 'GET'
  });
}

/**
 * Fetch full session history (active + revoked/expired).
 */
export async function getSessionsHistory() {
  return apiRequest<{ sessions: SessionHistoryEntry[] }>(`/me/sessions/history`, {
    method: 'GET'
  });
}

/**
 * Revoke a single session by id.
 */
export async function revokeSessionById(sessionId: string) {
  return apiRequest<{ ok: boolean }>(`/me/sessions/revoke`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  });
}

/**
 * Revoke all sessions (optionally including current).
 */
export async function revokeAllSessions(params?: { includeCurrent?: boolean }) {
  return apiRequest<{ ok: boolean }>(`/me/sessions/revoke-all`, {
    method: 'POST',
    body: JSON.stringify({ include_current: params?.includeCurrent ?? true })
  });
}

/**
 * Regenerate MFA backup codes.
 */
export async function regenerateBackupCodes() {
  return apiRequest<{ backup_codes: string[] }>(`/me/mfa/backup-codes/regenerate`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

/**
 * Update security alert preferences.
 */
export async function updateSecurityAlerts(params: { email_enabled: boolean; sms_enabled: boolean }) {
  return apiRequest<{ ok: boolean }>(`/me/security/alerts`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Request recovery email verification.
 */
export async function requestRecoveryEmail(params: { email: string; password?: string }) {
  return apiRequest<{ ok: boolean; email_sent?: boolean }>(`/me/recovery-email`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * Remove recovery email.
 */
export async function removeRecoveryEmail(params?: { password?: string }) {
  return apiRequest<{ ok: boolean }>(`/me/recovery-email`, {
    method: 'DELETE',
    body: JSON.stringify(params ?? {})
  });
}

/**
 * Request account deletion (GDPR).
 */
export async function requestAccountDeletion() {
  return apiRequest<{ status: string }>(`/me/gdpr/delete/request`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}
