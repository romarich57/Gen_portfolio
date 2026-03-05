import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import '../setupEnv';

import { buildOtpRateLimiter, resetOtpRateLimitBuckets } from '../../src/middleware/otpRateLimit';
import { hashToken } from '../../src/utils/crypto';

const OTP_LIMITS = {
  phoneStart: { windowMs: 60_000, limit: 2, targetLimit: 2 },
  phoneCheck: { windowMs: 60_000, limit: 5, targetLimit: 5, maxAttempts: 5 }
};

function createReq(): Request {
  return {
    ip: '127.0.0.1',
    id: 'req-test',
    body: { phoneE164: '+14155552671' }
  } as Request;
}

function createRes(): { res: Response; state: { statusCode: number; body: unknown } } {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: null
  };

  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    }
  } as Response;

  return { res, state };
}

test('otp limiter fails closed in production when Redis is unavailable', async () => {
  resetOtpRateLimitBuckets();
  const limiter = buildOtpRateLimiter('phoneStart', {
    getLimits: async () => OTP_LIMITS,
    getRedisClient: () => ({
      sendCommand: async () => {
        throw new Error('redis unavailable');
      }
    }),
    isProduction: true,
    isTest: false,
    warn: () => undefined
  });

  const req = createReq();
  const { res, state } = createRes();
  let nextCalled = false;
  await limiter(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 503);
  assert.deepEqual(state.body, {
    error: 'RATE_LIMIT_UNAVAILABLE',
    request_id: 'req-test'
  });
});

test('otp limiter uses Redis counter and blocks when limit is exceeded', async () => {
  resetOtpRateLimitBuckets();
  const redisCalls: [string, ...string[]][] = [];
  const counters = new Map<string, number>();
  const limiter = buildOtpRateLimiter('phoneStart', {
    getLimits: async () => OTP_LIMITS,
    getRedisClient: () => ({
      sendCommand: async (args: [string, ...string[]]) => {
        redisCalls.push(args);
        const key = args[3];
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return next;
      }
    }),
    isProduction: true,
    isTest: false,
    warn: () => undefined
  });

  const req = createReq();

  for (let i = 0; i < 2; i += 1) {
    const { res, state } = createRes();
    let nextCalled = false;
    await limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(state.statusCode, 200);
  }

  const blocked = createRes();
  let blockedNextCalled = false;
  await limiter(req, blocked.res, () => {
    blockedNextCalled = true;
  });

  assert.equal(blockedNextCalled, false);
  assert.equal(blocked.state.statusCode, 429);
  assert.deepEqual(blocked.state.body, {
    error: 'RATE_LIMITED',
    message: 'Too many requests',
    captcha_required: true,
    request_id: 'req-test'
  });
  assert.equal(redisCalls.length, 5);
  assert.equal(redisCalls[0][0], 'EVAL');
  const phoneHash = hashToken('+14155552671');
  assert.equal(redisCalls[0][3], `otp_rl:v2:phoneStart:actor:127.0.0.1:anon:${phoneHash}`);
  assert.equal(redisCalls[1][3], `otp_rl:v2:phoneStart:target:${phoneHash}`);
});

test('otp limiter canonicalizes equivalent phone formats into the same keys', async () => {
  resetOtpRateLimitBuckets();
  const redisCalls: [string, ...string[]][] = [];
  const limiter = buildOtpRateLimiter('phoneStart', {
    getLimits: async () => OTP_LIMITS,
    getRedisClient: () => ({
      sendCommand: async (args: [string, ...string[]]) => {
        redisCalls.push(args);
        return 1;
      }
    }),
    isProduction: true,
    isTest: false,
    warn: () => undefined
  });

  const requestA = createReq();
  requestA.body = { phoneE164: '+33 6 12 34 56 78' };
  const responseA = createRes();
  await limiter(requestA, responseA.res, () => undefined);
  assert.equal(responseA.state.statusCode, 200);

  const requestB = createReq();
  requestB.body = { phoneE164: '+33612345678' };
  const responseB = createRes();
  await limiter(requestB, responseB.res, () => undefined);
  assert.equal(responseB.state.statusCode, 200);

  assert.equal(redisCalls.length, 4);
  const actorKeyA = redisCalls[0][3];
  const targetKeyA = redisCalls[1][3];
  const actorKeyB = redisCalls[2][3];
  const targetKeyB = redisCalls[3][3];
  assert.equal(actorKeyA, actorKeyB);
  assert.equal(targetKeyA, targetKeyB);
  assert.ok(actorKeyA.startsWith('otp_rl:v2:phoneStart:actor:'));
  assert.ok(targetKeyA.startsWith('otp_rl:v2:phoneStart:target:'));

  const canonicalHash = hashToken('+33612345678');
  assert.equal(targetKeyA, `otp_rl:v2:phoneStart:target:${canonicalHash}`);
});
