import { rateLimit, ipKeyGenerator, type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../services/redis';
import { ACCESS_COOKIE_NAME } from '../config/auth';
import { verifyAccessToken } from '../utils/jwt';

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

function resolveRequestUserId(req: Request): string {
  if (typeof req.user?.id === 'string' && req.user.id.length > 0) {
    return req.user.id;
  }

  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!accessToken) return 'anon';

  try {
    const payload = verifyAccessToken(accessToken);
    return payload.sub || 'anon';
  } catch {
    return 'anon';
  }
}

const UUID_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTEGER_SEGMENT_PATTERN = /^\d+$/;
const OBJECT_ID_SEGMENT_PATTERN = /^[a-f0-9]{24}$/i;
const OPAQUE_ID_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizeDynamicSegments(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      const decodedSegment = decodePathSegment(segment);
      if (UUID_SEGMENT_PATTERN.test(decodedSegment)) return ':id';
      if (INTEGER_SEGMENT_PATTERN.test(decodedSegment)) return ':id';
      if (OBJECT_ID_SEGMENT_PATTERN.test(decodedSegment)) return ':id';
      if (OPAQUE_ID_SEGMENT_PATTERN.test(decodedSegment)) return ':id';
      return segment;
    })
    .join('/');
}

function resolveAdminRoutePattern(req: Request): string {
  const baseUrl = req.baseUrl || '';
  if (typeof req.route?.path === 'string') {
    return `${baseUrl}${req.route.path}`;
  }
  return `${baseUrl}${normalizeDynamicSegments(req.path || '')}`;
}

function adminKeyGenerator(req: Request): string {
  const routePattern = resolveAdminRoutePattern(req);
  const ipKey = ipKeyGenerator(req.ip || '0.0.0.0');
  const actor = resolveRequestUserId(req);
  return [actor, ipKey, req.method, routePattern].join('|');
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
  skip: (req) => req.originalUrl.startsWith('/webhooks/stripe')
});

const healthLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip || '0.0.0.0')
});

const adminReadBurstLimiter = buildRateLimiter({
  windowMs: 10 * 1000,
  limit: 8,
  keyGenerator: adminKeyGenerator
});

const adminReadCooldownLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: adminKeyGenerator
});

const adminWriteBurstLimiter = buildRateLimiter({
  windowMs: 10 * 1000,
  limit: 4,
  keyGenerator: adminKeyGenerator
});

const adminWriteCooldownLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 12,
  keyGenerator: adminKeyGenerator
});

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function runRateLimiterChain(handlers: RateLimitRequestHandler[], req: Request, res: Response, next: NextFunction): void {
  let index = 0;

  const run = (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }

    const handler = handlers[index];
    index += 1;
    if (!handler) {
      next();
      return;
    }

    handler(req, res, run);
  };

  run();
}

function adminApiLimiter(req: Request, res: Response, next: NextFunction): void {
  const isRead = SAFE_METHODS.has(req.method);
  const handlers = isRead
    ? [adminReadBurstLimiter, adminReadCooldownLimiter]
    : [adminWriteBurstLimiter, adminWriteCooldownLimiter];
  runRateLimiterChain(handlers, req, res, next);
}

export { buildRateLimiter, buildRateLimitKey, accountKeyGenerator, globalLimiter, adminApiLimiter, healthLimiter };
