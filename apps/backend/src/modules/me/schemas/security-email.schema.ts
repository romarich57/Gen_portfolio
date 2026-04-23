import { z } from 'zod';

export const recoveryEmailSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().optional()
});

export const recoveryEmailRemoveSchema = z.object({
  password: z.string().optional()
});

export const securityAlertsSchema = z.object({
  email_enabled: z.boolean(),
  sms_enabled: z.boolean()
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128)
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'passwords_do_not_match',
    path: ['confirmPassword']
  });

export const changeEmailSchema = z.object({
  newEmail: z.string().email().max(320),
  password: z.string().optional()
});
