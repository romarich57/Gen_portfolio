import { z } from 'zod';

export const resendEmailSchema = z.object({
  email: z.string().email().max(320)
});

export const actionConfirmationSchema = z.object({
  confirmation_token: z.string().min(10).max(4096)
});
