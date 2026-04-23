import type { Response } from 'express';

export function sendValidationError(res: Response, requestId: string) {
  res.status(400).json({ error: 'VALIDATION_ERROR', request_id: requestId });
}
