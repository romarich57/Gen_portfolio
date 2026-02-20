import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID_REGEX.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}

export { requestId };
