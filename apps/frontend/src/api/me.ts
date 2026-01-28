import { apiRequest } from './http';
import type { OnboardingStatus, UserProfile } from './types';

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
