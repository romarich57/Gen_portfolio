import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const cspDirectives: Record<string, string[]> = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"]
};

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: cspDirectives
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  noSniff: true,
  hsts: env.isProduction
    ? {
        maxAge: 15552000,
        includeSubDomains: true,
        preload: true
      }
    : false,
  crossOriginResourcePolicy: { policy: 'same-site' }
});

function permissionsPolicy(req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  next();
}

export { helmetMiddleware, permissionsPolicy, cspDirectives };
