import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getOtpRateLimits } from '../services/settings';
import { env } from '../config/env';
import { getRedisClient } from '../services/redis';
import { logger } from './logger';
import { ACCESS_COOKIE_NAME, ONBOARDING_COOKIE_NAME } from '../config/auth';
import { verifyAccessToken, verifyChallengeToken } from '../utils/jwt';
import { hashToken } from '../utils/crypto';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const OTP_RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;
type OtpRateLimiterKind = 'phoneStart' | 'phoneCheck';
type RedisCommandClient = {
  sendCommand: (args: [string, ...string[]]) => Promise<unknown>;
};
type OtpRateLimiterDeps = {
  getLimits: typeof getOtpRateLimits;
  getRedisClient: () => RedisCommandClient | null;
  isProduction: boolean;
  isTest: boolean;
  warn: (meta: Record<string, unknown>, message: string) => void;
};
const defaultDeps: OtpRateLimiterDeps = {
  getLimits: getOtpRateLimits,
  getRedisClient: getRedisClient as () => RedisCommandClient | null,
  isProduction: env.isProduction,
  isTest: env.isTest,
  warn: (meta, message) => logger.warn(meta, message)
};

function getIp(req: Request): string {
  return req.ip || '0.0.0.0';
}

function getActorId(req: Request): string {
  if (req.user?.id) return req.user.id;

  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      if (payload.sub) return payload.sub;
    } catch {
      // Ignore invalid access tokens in rate limiter identity resolution.
    }
  }

  const onboardingToken = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
  if (onboardingToken) {
    try {
      const payload = verifyChallengeToken(onboardingToken);
      if (payload.sub) return payload.sub;
    } catch {
      // Ignore invalid onboarding tokens in rate limiter identity resolution.
    }
  }

  return 'anon';
}

function getPhoneHash(req: Request): string {
  const rawPhone = typeof req.body?.phoneE164 === 'string' ? req.body.phoneE164.trim() : '';
  if (!rawPhone) return 'no_phone';
  return hashToken(rawPhone);
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

function buildOtpActorRedisKey(kind: OtpRateLimiterKind, ip: string, actorId: string, phoneHash: string): string {
  return `otp_rl:v2:${kind}:actor:${ip}:${actorId}:${phoneHash}`;
}

function buildOtpTargetRedisKey(kind: OtpRateLimiterKind, phoneHash: string): string {
  return `otp_rl:v2:${kind}:target:${phoneHash}`;
}

async function incrementRedisBucket(client: RedisCommandClient, key: string, windowMs: number): Promise<number> {
  const rawCount = await client.sendCommand(['EVAL', OTP_RATE_LIMIT_LUA, '1', key, String(windowMs)]);
  const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
  if (!Number.isFinite(count)) {
    throw new Error('OTP_RATE_LIMIT_REDIS_INVALID_RESPONSE');
  }
  return count;
}

function consumeMemoryBucket(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  cleanupExpired(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function sendRateLimited(res: Response, requestId: string): void {
  res.status(429).json({
    error: 'RATE_LIMITED',
    message: 'Too many requests',
    captcha_required: true,
    request_id: requestId
  });
}

function buildOtpRateLimiter(kind: OtpRateLimiterKind, deps: OtpRateLimiterDeps = defaultDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const limits = await deps.getLimits();
    const config = kind === 'phoneStart' ? limits.phoneStart : limits.phoneCheck;
    const ip = getIp(req);
    const actorId = getActorId(req);
    const phoneHash = getPhoneHash(req);
    const actorMemoryKey = `otp_mem:v2:${kind}:actor:${ip}:${actorId}:${phoneHash}`;
    const targetMemoryKey = `otp_mem:v2:${kind}:target:${phoneHash}`;

    if (!deps.isTest) {
      const redisClient = deps.getRedisClient();
      if (!redisClient && deps.isProduction) {
        res.status(503).json({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: req.id });
        return;
      }

      if (redisClient) {
        try {
          const actorCount = await incrementRedisBucket(
            redisClient,
            buildOtpActorRedisKey(kind, ip, actorId, phoneHash),
            config.windowMs
          );
          if (actorCount > config.limit) {
            sendRateLimited(res, req.id);
            return;
          }

          const targetCount = await incrementRedisBucket(
            redisClient,
            buildOtpTargetRedisKey(kind, phoneHash),
            config.windowMs
          );
          if (targetCount > config.targetLimit) {
            sendRateLimited(res, req.id);
            return;
          }

          next();
          return;
        } catch (error) {
          deps.warn(
            {
              error,
              request_id: req.id,
              ip,
              kind,
              actor_id: actorId,
              phone_hash: phoneHash
            },
            'OTP rate limiter Redis unavailable'
          );
          if (deps.isProduction) {
            res.status(503).json({ error: 'RATE_LIMIT_UNAVAILABLE', request_id: req.id });
            return;
          }
        }
      }
    }

    const actorAllowed = consumeMemoryBucket(actorMemoryKey, config.limit, config.windowMs);
    if (!actorAllowed) {
      sendRateLimited(res, req.id);
      return;
    }

    const targetAllowed = consumeMemoryBucket(targetMemoryKey, config.targetLimit, config.windowMs);
    if (!targetAllowed) {
      sendRateLimited(res, req.id);
      return;
    }

    next();
  };
}

export { buildOtpRateLimiter, resetOtpRateLimitBuckets };
