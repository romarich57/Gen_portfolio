import { rateLimit, ipKeyGenerator, type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../services/redis';

type RateLimitConfig = {
  windowMs: number;
  limit: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
};

let storeCounter = 0;
function buildRedisStore(): RedisStore | undefined {
  const redisClient = getRedisClient();
  if (!redisClient) return undefined;
  const prefix = `rl:${storeCounter++}:`;
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args as unknown as [string, ...string[]]),
    prefix
  });
}

function buildRateLimitKey(req: Request): string {
  const route = `${req.baseUrl}${req.path}`;
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.toLowerCase() : '';
  const ipKey = ipKeyGenerator(req.ip || '0.0.0.0');
  return [ipKey, route, email || identifier].filter(Boolean).join('|');
}

function accountKeyGenerator(req: Request): string {
  const route = `${req.baseUrl}${req.path}`;
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.toLowerCase() : '';
  return [route, email || identifier].filter(Boolean).join('|') || route;
}

function rateLimitHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
  options: Options
): void {
  res.status(options.statusCode).json({
    error: 'RATE_LIMITED',
    message: 'Too many requests',
    captcha_required: true,
    request_id: req.id
  });
}

function buildRateLimiter({ windowMs, limit, keyGenerator, skip }: RateLimitConfig): RateLimitRequestHandler {
  const redisStore = buildRedisStore();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator ?? buildRateLimitKey,
    handler: rateLimitHandler,
    ...(redisStore ? { store: redisStore } : {}),
    ...(skip ? { skip } : {})
  });
}

const globalLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  skip: (req) =>
    req.originalUrl.startsWith('/webhooks/stripe') || req.originalUrl.startsWith('/health')
});

export { buildRateLimiter, buildRateLimitKey, accountKeyGenerator, globalLimiter };
