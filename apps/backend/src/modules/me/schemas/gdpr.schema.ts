import { z } from 'zod';

export const gdprExportSchema = z.object({
  captchaToken: z.string().optional()
});
