import { z } from 'zod';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  firstName: z.string().min(2).max(64),
  lastName: z.string().min(2).max(64),
  username: z.string().regex(USERNAME_REGEX),
  nationality: z.string().regex(/^[A-Za-z]{2}$/),
  captchaToken: z.string().optional()
});
