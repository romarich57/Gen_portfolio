import { Router } from 'express';
import { phoneCheckLimiter, phoneStartLimiter } from '../shared/rate-limits';
import {
  checkPhoneVerificationHandler,
  startPhoneVerificationHandler
} from '../handlers/phone.handlers';

const router = Router();

router.post('/phone/start', phoneStartLimiter, startPhoneVerificationHandler);
router.post('/phone/check', phoneCheckLimiter, checkPhoneVerificationHandler);

export { router as phoneRoutes };
