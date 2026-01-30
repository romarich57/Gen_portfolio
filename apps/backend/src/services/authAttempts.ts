import { prisma } from '../db/prisma';
import { AuthAttemptType } from '@prisma/client';

export async function recordAuthAttempt(params: {
  type: AuthAttemptType;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  userId?: string | null;
}): Promise<void> {
  await prisma.authAttempt.create({
    data: {
      type: params.type,
      email: params.email ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      success: params.success,
      userId: params.userId ?? null
    }
  });
}

export async function countRecentFailures(params: {
  type: AuthAttemptType;
  email?: string | null;
  ip?: string | null;
  windowMinutes: number;
}): Promise<number> {
  const since = new Date(Date.now() - params.windowMinutes * 60 * 1000);
  const orFilters = [
    params.email ? { email: params.email } : null,
    params.ip ? { ip: params.ip } : null
  ].filter(Boolean) as Array<Record<string, unknown>>;

  if (orFilters.length === 0) {
    return 0;
  }

  return prisma.authAttempt.count({
    where: {
      type: params.type,
      success: false,
      createdAt: { gte: since },
      OR: orFilters
    }
  });
}
