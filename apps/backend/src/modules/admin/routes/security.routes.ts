import { Router } from 'express';
import { requireAdmin, requireAdminRecentMfa } from '../../../middleware/adminAuth';
import {
  forceEmailVerificationHandler,
  revokeEmailVerificationHandler,
  revokeUserSessionsHandler,
  triggerAdminPasswordResetHandler
} from '../handlers/security.handlers';

const router = Router();

router.use(requireAdmin);
router.post('/users/:id/password/reset', requireAdminRecentMfa, triggerAdminPasswordResetHandler);
router.post('/users/:id/email/verify/force', requireAdminRecentMfa, forceEmailVerificationHandler);
router.post('/users/:id/email/verify/revoke', requireAdminRecentMfa, revokeEmailVerificationHandler);
router.post('/users/:id/sessions/revoke', requireAdminRecentMfa, revokeUserSessionsHandler);

export { router as adminSecurityRoutes };
