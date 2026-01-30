import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}

export { requestId };
