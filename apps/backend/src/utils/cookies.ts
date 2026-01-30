import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME,
  MFA_CHALLENGE_TTL_MINUTES,
  ONBOARDING_TTL_MINUTES
} from '../config/auth';
import { signChallengeToken } from './jwt';

function cookieBaseOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction || env.httpsEnabled,
    sameSite: 'strict' as const,
    path: '/',
    domain: env.cookieDomain ?? undefined,
    ...overrides
  };
}

function cookieOAuthOptions(): CookieOptions {
  return cookieBaseOptions({ sameSite: 'lax' });
}

function setAuthCookies(res: Response, params: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_COOKIE_NAME, params.accessToken, {
    ...cookieBaseOptions(),
    maxAge: env.accessTokenTtlMinutes * 60 * 1000
  });
  res.cookie(REFRESH_COOKIE_NAME, params.refreshToken, {
    ...cookieBaseOptions(),
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, cookieBaseOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, cookieBaseOptions());
}

function setOnboardingCookie(res: Response, userId: string, stage: 'phone' | 'mfa') {
  const token = signChallengeToken({ sub: userId, type: 'onboarding', stage }, ONBOARDING_TTL_MINUTES);
  res.cookie(ONBOARDING_COOKIE_NAME, token, {
    ...cookieBaseOptions(),
    maxAge: ONBOARDING_TTL_MINUTES * 60 * 1000
  });
}

function clearOnboardingCookie(res: Response) {
  res.clearCookie(ONBOARDING_COOKIE_NAME, cookieBaseOptions());
}

function setMfaChallengeCookie(res: Response, userId: string) {
  const token = signChallengeToken({ sub: userId, type: 'mfa' }, MFA_CHALLENGE_TTL_MINUTES);
  res.cookie(MFA_CHALLENGE_COOKIE_NAME, token, {
    ...cookieBaseOptions(),
    maxAge: MFA_CHALLENGE_TTL_MINUTES * 60 * 1000
  });
}

function clearMfaChallengeCookie(res: Response) {
  res.clearCookie(MFA_CHALLENGE_COOKIE_NAME, cookieBaseOptions());
}

export {
  cookieBaseOptions,
  cookieOAuthOptions,
  setAuthCookies,
  clearAuthCookies,
  setOnboardingCookie,
  clearOnboardingCookie,
  setMfaChallengeCookie,
  clearMfaChallengeCookie
};
