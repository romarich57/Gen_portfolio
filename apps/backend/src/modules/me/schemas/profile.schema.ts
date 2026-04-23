import { z } from 'zod';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

export const profileSchema = z.object({
  first_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }).optional(),
  last_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }).optional(),
  username: z.string().regex(USERNAME_REGEX, { message: 'username_invalid' }).optional(),
  nationality: z.string().regex(/^[A-Za-z]{2}$/, { message: 'country_invalid' }).optional(),
  locale: z.string().min(2, { message: 'min' }).max(10, { message: 'max' }).optional()
});

export const onboardingSchema = z.object({
  first_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }),
  last_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }),
  username: z.string().regex(USERNAME_REGEX, { message: 'username_invalid' }),
  nationality: z.string().regex(/^[A-Za-z]{2}$/, { message: 'country_invalid' })
});
