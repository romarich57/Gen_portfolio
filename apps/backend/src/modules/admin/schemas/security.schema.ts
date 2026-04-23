import { z } from 'zod';

export const passwordResetSchema = z.object({
  mode: z.enum(['force_reset', 'send_link'])
});

export const sessionsRevokeSchema = z.object({
  mode: z.enum(['all', 'current']).optional()
});
