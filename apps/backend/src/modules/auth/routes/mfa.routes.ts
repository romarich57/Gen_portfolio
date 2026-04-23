import { Router } from 'express';
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

router.post('/mfa/setup/start', startMfaSetupHandler);
router.post('/mfa/setup/confirm', mfaSetupConfirmIpLimiter, mfaSetupConfirmAccountLimiter, confirmMfaSetupHandler);
router.post('/mfa/verify', mfaVerifyIpLimiter, mfaVerifyAccountLimiter, verifyMfaChallengeHandler);

export { router as mfaRoutes };
