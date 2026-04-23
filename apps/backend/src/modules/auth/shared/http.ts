import type { Request, Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME
} from '../../../config/auth';
import { verifyAccessToken, verifyChallengeToken } from '../../../utils/jwt';

export function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function sendValidationError(res: Response, requestId: string) {
  res.status(400).json({ error: 'VALIDATION_ERROR', request_id: requestId });
}

export function getRequestMeta(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
  };
}

export function requireAccessUserId(req: Request, res: Response): string | null {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!accessToken) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return null;
  }

  try {
    const payload = verifyAccessToken(accessToken);
    return payload.sub;
  } catch {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return null;
  }
}

export function requireAccessOrOnboardingUserId(
  req: Request,
  res: Response,
  stage: 'phone' | 'mfa'
): string | null {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      return payload.sub;
    } catch {
      // Fall back to onboarding token.
    }
  }

  const token = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return null;
  }

  try {
    const payload = verifyChallengeToken(token);
    if (payload.type !== 'onboarding' || payload.stage !== stage) {
      res.status(403).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
      return null;
    }
    return payload.sub;
  } catch {
    res.status(401).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
    return null;
  }
}

export function requireMfaChallengeUserId(req: Request, res: Response): string | null {
  const token = req.cookies?.[MFA_CHALLENGE_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'MFA_CHALLENGE_REQUIRED', request_id: req.id });
    return null;
  }

  try {
    const payload = verifyChallengeToken(token);
    if (payload.type !== 'mfa') {
      res.status(403).json({ error: 'MFA_CHALLENGE_INVALID', request_id: req.id });
      return null;
    }
    return payload.sub;
  } catch {
    res.status(401).json({ error: 'MFA_CHALLENGE_INVALID', request_id: req.id });
    return null;
  }
}

export function respondMfaLockout(res: Response, requestId: string, retryAfterSeconds: number): void {
  res.status(429).json({
    error: 'MFA_TEMP_LOCKED',
    retry_after_seconds: retryAfterSeconds,
    captcha_required: true,
    request_id: requestId
  });
}
