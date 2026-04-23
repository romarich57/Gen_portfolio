import { Router } from 'express';
import { resetLimiter } from '../shared/rate-limits';
import {
  confirmPasswordResetHandler,
  requestPasswordResetHandler,
  setPasswordHandler
} from '../handlers/password.handlers';

const router = Router();

router.post('/password/reset/request', resetLimiter, requestPasswordResetHandler);
router.post('/password/reset/confirm', confirmPasswordResetHandler);
router.post('/set-password', setPasswordHandler);

export { router as passwordRoutes };
