import { z } from 'zod';

export const auditQuerySchema = z.object({
  userId: z.string().optional(),
  action_type: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});
