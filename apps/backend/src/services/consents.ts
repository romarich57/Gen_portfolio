import { prisma } from '../db/prisma';
import { hashToken } from '../utils/crypto';
import { ConsentSource } from '@prisma/client';

export async function recordConsent(params: {
  userId: string;
  analyticsEnabled: boolean;
  adsEnabled: boolean;
  consentVersion: string;
  source: ConsentSource;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const ipHash = params.ip ? hashToken(params.ip) : null;
  const userAgentHash = params.userAgent ? hashToken(params.userAgent) : null;

  return prisma.consent.create({
    data: {
      userId: params.userId,
      analyticsEnabled: params.analyticsEnabled,
      adsEnabled: params.adsEnabled,
      consentVersion: params.consentVersion,
      consentedAt: new Date(),
      source: params.source,
      ipHash,
      userAgentHash
    }
  });
}
