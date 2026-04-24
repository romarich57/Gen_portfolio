import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../middleware/logger';

let cleanupHandle: NodeJS.Timeout | null = null;

const TOKEN_RETENTION_DAYS = 30;
const COMPLETED_REQUEST_RETENTION_DAYS = 7;

function retentionDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function cleanupExpiredSecurityTokens() {
  const now = new Date();
  const tokenRetentionCutoff = retentionDate(TOKEN_RETENTION_DAYS);
  const completedRequestCutoff = retentionDate(COMPLETED_REQUEST_RETENTION_DAYS);

  const [
    securityActionTokens,
    emailVerificationTokens,
    recoveryEmailTokens,
    passwordResetTokens,
    authAttempts,
    phoneVerifications,
    emailChangeRequests,
    oauthLinkRequests
  ] = await prisma.$transaction([
    prisma.securityActionToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null }, createdAt: { lt: tokenRetentionCutoff } }
        ]
      }
    }),
    prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null }, createdAt: { lt: tokenRetentionCutoff } }
        ]
      }
    }),
    prisma.recoveryEmailToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null }, createdAt: { lt: tokenRetentionCutoff } }
        ]
      }
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null }, createdAt: { lt: tokenRetentionCutoff } }
        ]
      }
    }),
    prisma.authAttempt.deleteMany({
      where: { createdAt: { lt: tokenRetentionCutoff } }
    }),
    prisma.phoneVerification.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { createdAt: { lt: tokenRetentionCutoff } }
        ]
      }
    }),
    prisma.emailChangeRequest.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { cancelledAt: { lt: completedRequestCutoff } },
          { completedAt: { lt: completedRequestCutoff } }
        ]
      }
    }),
    prisma.oAuthLinkRequest.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { completedAt: { lt: completedRequestCutoff } }
        ]
      }
    })
  ]);

  return (
    securityActionTokens.count +
    emailVerificationTokens.count +
    recoveryEmailTokens.count +
    passwordResetTokens.count +
    authAttempts.count +
    phoneVerifications.count +
    emailChangeRequests.count +
    oauthLinkRequests.count
  );
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
