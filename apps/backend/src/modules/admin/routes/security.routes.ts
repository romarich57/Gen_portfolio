import { Router } from 'express';
import { requireAdmin } from '../../../middleware/adminAuth';
import {
  forceEmailVerificationHandler,
  revokeEmailVerificationHandler,
  revokeUserSessionsHandler,
  triggerAdminPasswordResetHandler
} from '../handlers/security.handlers';

const router = Router();

router.use(requireAdmin);
router.post('/users/:id/password/reset', triggerAdminPasswordResetHandler);
router.post('/users/:id/email/verify/force', forceEmailVerificationHandler);
router.post('/users/:id/email/verify/revoke', revokeEmailVerificationHandler);
router.post('/users/:id/sessions/revoke', revokeUserSessionsHandler);

export { router as adminSecurityRoutes };
