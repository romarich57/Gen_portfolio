import { z } from 'zod';

export const resetRequestSchema = z.object({
  email: z.string().email().max(320),
  captchaToken: z.string().optional()
});

export const resetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(12).max(128)
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(12).max(128),
    password_confirmation: z.string().min(12).max(128)
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'passwords_do_not_match'
  });
