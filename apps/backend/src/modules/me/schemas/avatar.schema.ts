import { z } from 'zod';

export const avatarUploadSchema = z.object({
  mime_type: z.string().min(3).max(120),
  size_bytes: z.number().int().positive()
});

export const avatarConfirmSchema = z.object({
  file_id: z.string().uuid()
});
