import { Router } from 'express';
import { requireOnboardingToken } from '../../../middleware/onboardingAuth';
import {
  mfaSetupConfirmAccountLimiter,
  mfaSetupConfirmIpLimiter,
  mfaVerifyAccountLimiter,
  mfaVerifyIpLimiter
} from '../shared/rate-limits';
import {
  confirmMfaSetupHandler,
  startMfaSetupHandler,
  verifyMfaChallengeHandler
} from '../handlers/mfa.handlers';

const router = Router();

router.post('/mfa/setup/start', requireOnboardingToken('mfa', { allowAccessSession: true }), startMfaSetupHandler);
router.post(
  '/mfa/setup/confirm',
  requireOnboardingToken('mfa', { allowAccessSession: true }),
  mfaSetupConfirmIpLimiter,
  mfaSetupConfirmAccountLimiter,
  confirmMfaSetupHandler
);
router.post('/mfa/verify', mfaVerifyIpLimiter, mfaVerifyAccountLimiter, verifyMfaChallengeHandler);

export { router as mfaRoutes };
