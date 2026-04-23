import { Prisma } from '@prisma/client';
import { getProfile, updateProfile } from '../../../services/profile';
import { normalizeUsername } from '../../../utils/normalize';
import { isUsernameAvailable } from '../shared/service-helpers';

type UpdateProfileInput = {
  first_name?: string | undefined;
  last_name?: string | undefined;
  username?: string | undefined;
  nationality?: string | undefined;
  locale?: string | undefined;
};

export async function getProfileForUser(userId: string) {
  const profile = await getProfile(userId);
  if (!profile) {
    throw new Error('NOT_FOUND');
  }

  return profile;
}

export async function updateProfileForUser(userId: string, input: UpdateProfileInput) {
  const data: {
    firstName?: string;
    lastName?: string;
    username?: string;
    nationality?: string;
    locale?: string;
  } = {};

  if (input.first_name !== undefined) data.firstName = input.first_name.trim();
  if (input.last_name !== undefined) data.lastName = input.last_name.trim();
  if (input.username !== undefined) {
    const desiredUsername = normalizeUsername(input.username);
    const available = await isUsernameAvailable({ userId, username: desiredUsername });
    if (!available) {
      throw new Error('USERNAME_UNAVAILABLE');
    }
    data.username = desiredUsername;
  }
  if (input.nationality !== undefined) data.nationality = input.nationality.toUpperCase();
  if (input.locale !== undefined) data.locale = input.locale;

  try {
    await updateProfile({
      userId,
      data
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('USERNAME_UNAVAILABLE');
    }
    throw error;
  }
}
