import { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { buildRateLimiter } from '../../../middleware/rateLimit';

function userKey(req: Request): string {
  return [req.user?.id ?? 'anon', req.method, req.baseUrl, req.path].join('|');
}

function userResumeKey(req: Request): string {
  return [req.user?.id ?? 'anon', req.params.id ?? 'no-resume', req.method].join('|');
}

export const resumeReadLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: userKey
});

export const resumeWriteLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: userKey
});

export const resumePatchLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: userResumeKey
});

export const resumeAssetLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: userKey
});

export const resumeExportLimiter = buildRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: userKey
});

export const resumeAiLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: userKey
});

export const resumeAiImportIpLimiter = buildRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => ipKeyGenerator(req.ip || '0.0.0.0')
});
