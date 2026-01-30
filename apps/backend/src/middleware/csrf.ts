import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { isOriginAllowed } from './cors';
import { env } from '../config/env';

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function issueCsrfToken(_req: Request, res: Response): void {
  const token = generateToken();
  res.cookie('csrf_token', token, {
    httpOnly: false,
    secure: env.isProduction || env.httpsEnabled,
    sameSite: 'strict',
    path: '/'
  });
  res.json({ csrfToken: token });
}

function extractOrigin(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.originalUrl.startsWith('/webhooks/stripe')) return next();

  const origin = normalizeHeader(req.headers.origin);
  const referer = normalizeHeader(req.headers.referer);

  const rawOrigin = origin || referer;
  if (!rawOrigin) {
    res.status(403).json({
      error: 'CSRF_ORIGIN_MISSING',
      request_id: req.id
    });
    return;
  }

  const parsedOrigin = origin ? origin : extractOrigin(referer);
  if (!parsedOrigin || !isOriginAllowed(parsedOrigin)) {
    res.status(403).json({
      error: 'CSRF_ORIGIN_INVALID',
      request_id: req.id
    });
    return;
  }

  const headerToken = normalizeHeader(req.headers['x-csrf-token']);
  const cookieToken = req.cookies?.csrf_token as string | undefined;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      request_id: req.id
    });
    return;
  }

  next();
}

export { issueCsrfToken, csrfProtection };
