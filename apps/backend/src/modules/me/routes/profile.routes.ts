import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import {
  getProfileHandler,
  updateProfileHandler
} from '../handlers/profile.handlers';

const router = Router();

router.get('/', requireAuth, getProfileHandler);
router.patch('/', requireAuth, updateProfileHandler);

export { router as profileRoutes };
