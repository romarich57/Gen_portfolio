import type { ErrorRequestHandler } from 'express';
import { logger } from './logger';

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const error = err as { message?: string; type?: string };

  if (error?.message === 'CORS_ORIGIN_DENIED') {
    res.status(403).json({
      error: 'CORS_ORIGIN_DENIED',
      request_id: req.id
    });
    return;
  }

  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      request_id: req.id
    });
    return;
  }

  logger.error({ err, request_id: req.id }, 'Unhandled error');
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    request_id: req.id
  });
};

export { errorHandler };
