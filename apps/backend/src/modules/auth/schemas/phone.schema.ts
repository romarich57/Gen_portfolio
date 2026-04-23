import { z } from 'zod';

export const phoneStartSchema = z.object({
  phoneE164: z.string().min(6).max(32),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional()
});

export const phoneCheckSchema = z.object({
  phoneE164: z.string().min(6).max(32),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  code: z.string().min(4).max(10)
});
