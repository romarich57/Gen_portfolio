import { z } from 'zod';

export const usersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(['user', 'premium', 'vip', 'admin', 'super_admin']).optional(),
  status: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});

export const revealSchema = z.object({
  fields: z.array(z.string()).min(1),
  confirm: z.string()
});

export const roleSchema = z.object({
  role: z.enum(['user', 'premium', 'vip', 'admin', 'super_admin'])
});

export const statusSchema = z.object({
  status_action: z.enum(['ban', 'unban', 'deactivate', 'reactivate'])
});
