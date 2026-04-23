import { z } from 'zod';

export const checkoutSchema = z.object({
  planCode: z.enum(['FREE', 'PREMIUM', 'VIP']),
  captchaToken: z.string().optional()
});

export const syncSchema = z.object({
  sessionId: z.string().min(8)
});
