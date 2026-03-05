import { getRedisClient } from './redis';

type MfaProtectionScope = 'setup_confirm' | 'verify';

type MfaProtectionState = {
  captchaRequired: boolean;
  locked: boolean;
  retryAfterSeconds: number;
};

const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const CAPTCHA_THRESHOLD = 3;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const memoryFailures = new Map<string, { count: number; resetAt: number }>();
const memoryLocks = new Map<string, number>();

type RedisCommandClient = {
  sendCommand: (args: [string, ...string[]]) => Promise<unknown>;
};

function buildFailureKey(scope: MfaProtectionScope, actorId: string): string {
  return `mfa_protection:v1:${scope}:fail:${actorId}`;
}

function buildLockKey(scope: MfaProtectionScope, actorId: string): string {
  return `mfa_protection:v1:${scope}:lock:${actorId}`;
}

function buildMemoryKey(scope: MfaProtectionScope, actorId: string): string {
  return `${scope}:${actorId}`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number.NaN;
}

function toPositiveSeconds(ms: number): number {
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 1000));
}

function getRedisCommandClient(): RedisCommandClient | null {
  return getRedisClient() as unknown as RedisCommandClient | null;
}

function cleanupMemory(now: number): void {
  for (const [key, record] of memoryFailures) {
    if (record.resetAt <= now) {
      memoryFailures.delete(key);
    }
  }
  for (const [key, lockedUntil] of memoryLocks) {
    if (lockedUntil <= now) {
      memoryLocks.delete(key);
    }
  }
}

function resolveMemoryState(scope: MfaProtectionScope, actorId: string): MfaProtectionState {
  const now = Date.now();
  cleanupMemory(now);

  const memoryKey = buildMemoryKey(scope, actorId);
  const lockedUntil = memoryLocks.get(memoryKey) ?? 0;
  if (lockedUntil > now) {
    return {
      captchaRequired: true,
      locked: true,
      retryAfterSeconds: toPositiveSeconds(lockedUntil - now)
    };
  }

  const failureCount = memoryFailures.get(memoryKey)?.count ?? 0;
  return {
    captchaRequired: failureCount >= CAPTCHA_THRESHOLD,
    locked: false,
    retryAfterSeconds: 0
  };
}

async function resolveRedisState(scope: MfaProtectionScope, actorId: string): Promise<MfaProtectionState | null> {
  const redisClient = getRedisCommandClient();
  if (!redisClient) return null;

  try {
    const lockKey = buildLockKey(scope, actorId);
    const failureKey = buildFailureKey(scope, actorId);
    const lockTtlRaw = await redisClient.sendCommand(['PTTL', lockKey]);
    const lockTtl = toNumber(lockTtlRaw);
    if (Number.isFinite(lockTtl) && lockTtl > 0) {
      return {
        captchaRequired: true,
        locked: true,
        retryAfterSeconds: toPositiveSeconds(lockTtl)
      };
    }

    const failureCountRaw = await redisClient.sendCommand(['GET', failureKey]);
    const failureCount = toNumber(failureCountRaw);
    return {
      captchaRequired: Number.isFinite(failureCount) && failureCount >= CAPTCHA_THRESHOLD,
      locked: false,
      retryAfterSeconds: 0
    };
  } catch {
    return null;
  }
}

async function getMfaProtectionState(scope: MfaProtectionScope, actorId: string): Promise<MfaProtectionState> {
  if (!actorId) {
    return {
      captchaRequired: false,
      locked: false,
      retryAfterSeconds: 0
    };
  }

  const redisState = await resolveRedisState(scope, actorId);
  if (redisState) {
    return redisState;
  }

  return resolveMemoryState(scope, actorId);
}

async function recordMfaFailure(scope: MfaProtectionScope, actorId: string): Promise<MfaProtectionState> {
  if (!actorId) {
    return {
      captchaRequired: false,
      locked: false,
      retryAfterSeconds: 0
    };
  }

  const redisClient = getRedisCommandClient();
  if (redisClient) {
    try {
      const failureKey = buildFailureKey(scope, actorId);
      const lockKey = buildLockKey(scope, actorId);
      const incrementedRaw = await redisClient.sendCommand(['INCR', failureKey]);
      const failureCount = toNumber(incrementedRaw);
      if (failureCount === 1) {
        await redisClient.sendCommand(['PEXPIRE', failureKey, String(FAILURE_WINDOW_MS)]);
      }
      if (Number.isFinite(failureCount) && failureCount >= LOCKOUT_THRESHOLD) {
        await redisClient.sendCommand(['SET', lockKey, '1', 'PX', String(LOCKOUT_MS)]);
      }
      const state = await resolveRedisState(scope, actorId);
      if (state) return state;
    } catch {
      // fall back to memory buckets
    }
  }

  const now = Date.now();
  cleanupMemory(now);
  const memoryKey = buildMemoryKey(scope, actorId);
  const existing = memoryFailures.get(memoryKey);
  if (!existing || existing.resetAt <= now) {
    memoryFailures.set(memoryKey, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
  } else {
    existing.count += 1;
  }

  const count = memoryFailures.get(memoryKey)?.count ?? 0;
  if (count >= LOCKOUT_THRESHOLD) {
    memoryLocks.set(memoryKey, now + LOCKOUT_MS);
  }

  return resolveMemoryState(scope, actorId);
}

async function clearMfaFailures(scope: MfaProtectionScope, actorId: string): Promise<void> {
  if (!actorId) return;

  const redisClient = getRedisCommandClient();
  if (redisClient) {
    try {
      await redisClient.sendCommand(['DEL', buildFailureKey(scope, actorId), buildLockKey(scope, actorId)]);
    } catch {
      // fall back to memory cleanup only
    }
  }

  const memoryKey = buildMemoryKey(scope, actorId);
  memoryFailures.delete(memoryKey);
  memoryLocks.delete(memoryKey);
}

function resetMfaProtectionBuckets(): void {
  memoryFailures.clear();
  memoryLocks.clear();
}

export {
  getMfaProtectionState,
  recordMfaFailure,
  clearMfaFailures,
  resetMfaProtectionBuckets,
  type MfaProtectionScope,
  type MfaProtectionState
};
