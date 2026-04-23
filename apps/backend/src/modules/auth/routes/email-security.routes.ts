import { Router } from 'express';
import { resendLimiter } from '../shared/rate-limits';
import {
  confirmAcknowledgeSecurityAlertHandler,
  confirmEmailChangeHandler,
  confirmEmailVerificationHandler,
  confirmRecoveryEmailHandler,
  confirmSecurityRevokeSessionsHandler,
  getAcknowledgeSecurityAlertHandler,
  getEmailChangeVerificationHandler,
  getEmailVerificationHandler,
  getRecoveryEmailVerificationHandler,
  getSecurityRevokeSessionsHandler,
  resendVerificationEmailHandler
} from '../handlers/email-security.handlers';

const router = Router();

router.post('/email/resend', resendLimiter, resendVerificationEmailHandler);
router.get('/email/verify', getEmailVerificationHandler);
router.post('/email/verify', confirmEmailVerificationHandler);
router.get('/recovery-email/verify', getRecoveryEmailVerificationHandler);
router.post('/recovery-email/verify', confirmRecoveryEmailHandler);
router.get('/security/revoke-sessions', getSecurityRevokeSessionsHandler);
router.post('/security/revoke-sessions', confirmSecurityRevokeSessionsHandler);
router.get('/security/acknowledge-alert', getAcknowledgeSecurityAlertHandler);
router.post('/security/acknowledge-alert', confirmAcknowledgeSecurityAlertHandler);
router.get('/email/change/verify', getEmailChangeVerificationHandler);
router.post('/email/change/verify', confirmEmailChangeHandler);

export { router as emailSecurityRoutes };
