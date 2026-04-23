import { z } from 'zod';

export const oauthProviderSchema = z.enum(['google', 'github']);

export const unlinkOAuthSchema = z.object({
  provider: z.enum(['google', 'github'])
});
