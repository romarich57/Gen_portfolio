import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import {
  ACCESS_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME
} from '../../../config/auth';
import { buildRateLimiter, accountKeyGenerator } from '../../../middleware/rateLimit';
import { buildOtpRateLimiter } from '../../../middleware/otpRateLimit';
import { verifyAccessToken, verifyChallengeToken } from '../../../utils/jwt';

const ipOnly = (req: Request) => ipKeyGenerator(req.ip || '0.0.0.0');

function resolveMfaActorId(req: Request): string {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      if (payload.sub) return payload.sub;
    } catch {
      // Ignore invalid access token in limiter key generation.
    }
  }

  const onboardingToken = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
  if (onboardingToken) {
    try {
      const payload = verifyChallengeToken(onboardingToken);
      if (payload.type === 'onboarding' && payload.stage === 'mfa') {
        return payload.sub;
      }
    } catch {
      // Ignore invalid onboarding token in limiter key generation.
    }
  }

  const mfaChallengeToken = req.cookies?.[MFA_CHALLENGE_COOKIE_NAME] as string | undefined;
  if (mfaChallengeToken) {
    try {
      const payload = verifyChallengeToken(mfaChallengeToken);
      if (payload.type === 'mfa') {
        return payload.sub;
      }
    } catch {
      // Ignore invalid challenge token in limiter key generation.
    }
  }

  return 'anon';
}

const mfaAccountLimiterKey = (req: Request) => `${req.baseUrl}${req.path}|${resolveMfaActorId(req)}`;

export const loginAccountLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: accountKeyGenerator
});
export const loginIpLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 5, keyGenerator: ipOnly });
export const registerLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 3, keyGenerator: ipOnly });
export const resetLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 3, keyGenerator: ipOnly });
export const resendLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 3, keyGenerator: ipOnly });
export const refreshLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 10 });
export const phoneStartLimiter = buildOtpRateLimiter('phoneStart');
export const phoneCheckLimiter = buildOtpRateLimiter('phoneCheck');
export const mfaVerifyIpLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 10, keyGenerator: ipOnly });
export const mfaSetupConfirmIpLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 10, keyGenerator: ipOnly });
export const mfaVerifyAccountLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: mfaAccountLimiterKey
});
export const mfaSetupConfirmAccountLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: mfaAccountLimiterKey
});
