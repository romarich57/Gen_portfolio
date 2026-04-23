import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import { buildRateLimiter } from '../../../middleware/rateLimit';
import {
  confirmAvatarUploadHandler,
  issueAvatarUploadHandler
} from '../handlers/avatar.handlers';

const router = Router();

const avatarLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user?.id ?? 'unknown'
});

router.post('/avatar/upload-url', requireAuth, avatarLimiter, issueAvatarUploadHandler);
router.post('/avatar/confirm', requireAuth, confirmAvatarUploadHandler);

export { router as avatarRoutes };
