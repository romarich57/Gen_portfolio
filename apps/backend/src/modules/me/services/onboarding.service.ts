import { Prisma } from '@prisma/client';
import { completeOnboarding, getOnboardingStatus } from '../../../services/profile';
import { normalizeUsername } from '../../../utils/normalize';
import { isUsernameAvailable } from '../shared/service-helpers';

export async function getOnboardingStatusForUser(userId: string) {
  const status = await getOnboardingStatus(userId);
  if (!status) {
    throw new Error('NOT_FOUND');
  }

  return status;
}

export async function completeOnboardingForUser(params: {
  userId: string;
  first_name: string;
  last_name: string;
  username: string;
  nationality: string;
}) {
  const desiredUsername = normalizeUsername(params.username);
  const usernameAvailable = await isUsernameAvailable({
    userId: params.userId,
    username: desiredUsername
  });

  if (!usernameAvailable) {
    throw new Error('USERNAME_UNAVAILABLE');
  }

  try {
    await completeOnboarding({
      userId: params.userId,
      data: {
        firstName: params.first_name.trim(),
        lastName: params.last_name.trim(),
        username: desiredUsername,
        nationality: params.nationality.toUpperCase()
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('USERNAME_UNAVAILABLE');
    }
    throw error;
  }
}
