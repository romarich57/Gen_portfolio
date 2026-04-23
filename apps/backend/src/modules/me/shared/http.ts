import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import { formatZodError } from '../../../utils/validation';

export function requireUserId(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return null;
  }

  return userId;
}

export function sendValidationError(res: Response, requestId: string, error: ZodError) {
  const formatted = formatZodError(error);
  res.status(400).json({
    error: 'VALIDATION_ERROR',
    fields: formatted.fields,
    issues: formatted.issues,
    request_id: requestId
  });
}
