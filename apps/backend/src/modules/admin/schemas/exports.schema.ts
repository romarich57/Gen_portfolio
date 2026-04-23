import { GdprExportStatus } from '@prisma/client';
import { z } from 'zod';

export const exportsQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.nativeEnum(GdprExportStatus).optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});
