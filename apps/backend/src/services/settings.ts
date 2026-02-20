import { prisma } from '../db/prisma';

export type OtpRateLimits = {
  phoneStart: { windowMs: number; limit: number; targetLimit: number };
  phoneCheck: { windowMs: number; limit: number; targetLimit: number; maxAttempts: number };
};

const DEFAULT_LIMITS: OtpRateLimits = {
  phoneStart: { windowMs: 60 * 1000, limit: 2, targetLimit: 2 },
  phoneCheck: { windowMs: 60 * 1000, limit: 5, targetLimit: 5, maxAttempts: 5 }
};

const CACHE_TTL_MS = 60 * 1000;
let cached: { value: OtpRateLimits; fetchedAt: number } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function getOtpRateLimits(): Promise<OtpRateLimits> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: 'otp_rate_limits' } });
  const raw = setting?.valueJson;
  if (!isRecord(raw)) {
    cached = { value: DEFAULT_LIMITS, fetchedAt: now };
    return DEFAULT_LIMITS;
  }

  const phoneStartRaw = isRecord(raw.phoneStart) ? raw.phoneStart : {};
  const phoneCheckRaw = isRecord(raw.phoneCheck) ? raw.phoneCheck : {};

  const resolved: OtpRateLimits = {
    phoneStart: {
      windowMs: toNumber(phoneStartRaw.windowMs, DEFAULT_LIMITS.phoneStart.windowMs),
      limit: toNumber(phoneStartRaw.limit, DEFAULT_LIMITS.phoneStart.limit),
      targetLimit: toNumber(phoneStartRaw.targetLimit, toNumber(phoneStartRaw.limit, DEFAULT_LIMITS.phoneStart.limit))
    },
    phoneCheck: {
      windowMs: toNumber(phoneCheckRaw.windowMs, DEFAULT_LIMITS.phoneCheck.windowMs),
      limit: toNumber(phoneCheckRaw.limit, DEFAULT_LIMITS.phoneCheck.limit),
      targetLimit: toNumber(phoneCheckRaw.targetLimit, toNumber(phoneCheckRaw.limit, DEFAULT_LIMITS.phoneCheck.limit)),
      maxAttempts: toNumber(phoneCheckRaw.maxAttempts, DEFAULT_LIMITS.phoneCheck.maxAttempts)
    }
  };

  cached = { value: resolved, fetchedAt: now };
  return resolved;
}

export function resetOtpRateLimitsCache() {
  cached = null;
}
