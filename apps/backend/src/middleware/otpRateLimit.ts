import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getOtpRateLimits } from '../services/settings';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getIp(req: Request): string {
  return req.ip || '0.0.0.0';
}

function cleanupExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function resetOtpRateLimitBuckets() {
  buckets.clear();
}

function buildOtpRateLimiter(kind: 'phoneStart' | 'phoneCheck'): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const limits = await getOtpRateLimits();
    const config = kind === 'phoneStart' ? limits.phoneStart : limits.phoneCheck;
    const now = Date.now();
    cleanupExpired(now);

    const key = `${getIp(req)}|${kind}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + config.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > config.limit) {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many requests',
        captcha_required: true,
        request_id: req.id
      });
      return;
    }

    next();
  };
}

export { buildOtpRateLimiter, resetOtpRateLimitBuckets };
