import { Router } from 'express';
import { buildRateLimiter } from '../../../middleware/rateLimit';
import { requireRecentMfa } from '../../../middleware/stepUp';
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

const routeScopedUserLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => {
    const routePath = typeof req.route?.path === 'string' ? req.route.path : req.path;
    return `${req.user?.id ?? 'unknown'}|${req.method}|${req.baseUrl}${routePath}`;
  }
});

const backupCodeLimiter = buildRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => `${req.user?.id ?? 'unknown'}|${req.method}|${req.baseUrl}${req.path}`
});

router.post('/mfa/backup-codes/regenerate', backupCodeLimiter, regenerateBackupCodesHandler);
router.post('/security/alerts', updateSecurityAlertsHandler);
router.post('/recovery-email', routeScopedUserLimiter, recoveryEmailLimiter, requestRecoveryEmailHandler);
router.delete('/recovery-email', routeScopedUserLimiter, removeRecoveryEmailHandler);
router.post('/password', routeScopedUserLimiter, changePasswordHandler);
router.post('/email', routeScopedUserLimiter, requireRecentMfa, requestEmailChangeHandler);

export { router as securityEmailRoutes };
