import { z } from 'zod';
import { ConsentSource } from '@prisma/client';

export const consentSchema = z.object({
  analytics_enabled: z.boolean(),
  ads_enabled: z.boolean(),
  consent_version: z.string().min(2).max(20),
  source: z.nativeEnum(ConsentSource)
});
