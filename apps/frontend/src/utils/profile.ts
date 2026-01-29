import type { UserProfile } from '@/api/types';

export function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.first_name &&
      profile.last_name &&
      profile.username &&
      profile.nationality &&
      profile.first_name.trim().length >= 2 &&
      profile.last_name.trim().length >= 2
  );
}
