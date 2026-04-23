import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import { buildRateLimiter } from '../../../middleware/rateLimit';
import {
  changePasswordHandler,
  regenerateBackupCodesHandler,
  removeRecoveryEmailHandler,
  requestEmailChangeHandler,
  requestRecoveryEmailHandler,
  updateSecurityAlertsHandler
} from '../handlers/security-email.handlers';

const router = Router();

const recoveryEmailLimiter = buildRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => req.user?.id ?? 'unknown'
});

router.post('/mfa/backup-codes/regenerate', requireAuth, regenerateBackupCodesHandler);
router.post('/security/alerts', requireAuth, updateSecurityAlertsHandler);
router.post('/recovery-email', requireAuth, recoveryEmailLimiter, requestRecoveryEmailHandler);
router.delete('/recovery-email', requireAuth, removeRecoveryEmailHandler);
router.post('/password', requireAuth, changePasswordHandler);
router.post('/email', requireAuth, requestEmailChangeHandler);

export { router as securityEmailRoutes };
