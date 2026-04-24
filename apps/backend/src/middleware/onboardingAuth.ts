import type { NextFunction, Request, Response } from 'express';
import { ACCESS_COOKIE_NAME, ONBOARDING_COOKIE_NAME } from '../config/auth';
import { verifyAccessToken, verifyChallengeToken } from '../utils/jwt';

type OnboardingStage = 'phone' | 'mfa';

function requireOnboardingToken(stage: OnboardingStage, options?: { allowAccessSession?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options?.allowAccessSession) {
      const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
      if (accessToken) {
        try {
          const payload = verifyAccessToken(accessToken);
          req.onboarding = {
            userId: payload.sub,
            stage,
            viaAccessSession: true
          };
          next();
          return;
        } catch {
          // Fall through to onboarding token validation.
        }
      }
    }

    const token = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
      return;
    }

    try {
      const payload = verifyChallengeToken(token);
      if (payload.type !== 'onboarding' || payload.stage !== stage) {
        res.status(403).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
        return;
      }

      req.onboarding = {
        userId: payload.sub,
        stage,
        viaAccessSession: false
      };
      next();
    } catch {
      res.status(401).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
    }
  };
}

export { requireOnboardingToken };
