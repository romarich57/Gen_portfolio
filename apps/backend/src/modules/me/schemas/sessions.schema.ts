import { z } from 'zod';

export const sessionRevokeSchema = z.object({
  session_id: z.string().min(8)
});

export const sessionsRevokeAllSchema = z.object({
  include_current: z.boolean().optional()
});
