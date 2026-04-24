import { Router } from 'express';
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

router.post('/avatar/upload-url', avatarLimiter, issueAvatarUploadHandler);
router.post('/avatar/confirm', confirmAvatarUploadHandler);

export { router as avatarRoutes };
