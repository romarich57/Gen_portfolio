import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { buildRateLimiter } from '../../../middleware/rateLimit';

const userKey = (req: { user?: { id: string } }) => req.user?.id ?? 'unknown';
const ipOnly = (req: Request) => ipKeyGenerator(req.ip || '0.0.0.0');

export const checkoutUserLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 3,
  keyGenerator: userKey
});

export const checkoutIpLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: ipOnly
});

export const portalLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: userKey
});
