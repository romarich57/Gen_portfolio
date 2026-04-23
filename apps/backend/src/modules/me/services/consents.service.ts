import { type ConsentSource } from '@prisma/client';
import { recordConsent } from '../../../services/consents';

export async function recordConsentsForUser(params: {
  userId: string;
  analytics_enabled: boolean;
  ads_enabled: boolean;
  consent_version: string;
  source: ConsentSource;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await recordConsent({
    userId: params.userId,
    analyticsEnabled: params.analytics_enabled,
    adsEnabled: params.ads_enabled,
    consentVersion: params.consent_version,
    source: params.source,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null
  });
}
