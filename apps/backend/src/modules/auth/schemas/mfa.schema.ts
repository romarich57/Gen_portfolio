import { z } from 'zod';

export const mfaSetupConfirmSchema = z.object({
  code: z.string().regex(/^\d{6,8}$/),
  captchaToken: z.string().optional()
});

export const mfaVerifySchema = z.object({
  code: z.string().min(6).max(11).regex(/^[A-Za-z0-9_-]+$/),
  captchaToken: z.string().optional()
});
