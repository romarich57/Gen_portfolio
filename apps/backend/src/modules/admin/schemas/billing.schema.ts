import { z } from 'zod';

export const planCreateSchema = z.object({
  code: z.enum(['FREE', 'PREMIUM', 'VIP']),
  name_fr: z.string().min(2).max(64),
  price_eur_cents: z.number().int().min(0),
  project_limit: z.number().int().nullable().optional(),
  credits_monthly: z.number().int().nullable().optional(),
  create_stripe: z.boolean().optional()
});

export const planUpdateSchema = z.object({
  name_fr: z.string().min(2).max(64).optional(),
  price_eur_cents: z.number().int().min(0).optional(),
  project_limit: z.number().int().nullable().optional(),
  credits_monthly: z.number().int().nullable().optional(),
  is_active: z.boolean().optional(),
  create_new_price: z.boolean().optional()
});

export const couponSchema = z.object({
  percent_off: z.number().int().min(1).max(100).optional(),
  amount_off: z.number().int().min(1).optional(),
  duration: z.enum(['once', 'repeating', 'forever']),
  code: z.string().min(3).max(40)
});

export const subscriptionChangeSchema = z.object({
  plan_code: z.enum(['FREE', 'PREMIUM', 'VIP']),
  proration: z.boolean().optional()
});

export const creditsAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(3).max(120)
});
