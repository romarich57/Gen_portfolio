import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().min(3).max(320).optional(),
    identifier: z.string().min(3).max(320).optional(),
    password: z.string().min(12).max(128),
    captchaToken: z.string().optional()
  })
  .refine((data) => Boolean(data.email || data.identifier), {
    message: 'identifier_required'
  });
