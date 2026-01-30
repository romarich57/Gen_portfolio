import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../middleware/logger';

let cleanupHandle: NodeJS.Timeout | null = null;

export async function cleanupExpiredSecurityTokens() {
  const now = new Date();
  const result = await prisma.securityActionToken.deleteMany({
    where: { expiresAt: { lt: now } }
  });
  return result.count;
}

export function startSecurityTokenCleanupCron() {
  if (env.isTest || !env.securityTokenCleanupCronEnabled) return null;

  const intervalMs = env.securityTokenCleanupCronIntervalMinutes * 60 * 1000;
  if (cleanupHandle) {
    clearInterval(cleanupHandle);
  }

  const tick = async () => {
    try {
      await cleanupExpiredSecurityTokens();
    } catch (error) {
      logger.warn({ error }, 'Security token cleanup failed');
    }
  };

  void tick();
  cleanupHandle = setInterval(tick, intervalMs);
  return () => {
    if (cleanupHandle) {
      clearInterval(cleanupHandle);
      cleanupHandle = null;
    }
  };
}
