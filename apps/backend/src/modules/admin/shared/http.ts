import type { Response } from 'express';

export function sendValidationError(res: Response, requestId: string) {
  res.status(400).json({ error: 'VALIDATION_ERROR', request_id: requestId });
}

export function getRouteParam(value: string | string[] | undefined) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
