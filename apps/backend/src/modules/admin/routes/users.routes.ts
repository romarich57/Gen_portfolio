import { Router } from 'express';
import { requireAdmin, requireAdminRecentMfa } from '../../../middleware/adminAuth';
import {
  getUserDetailsHandler,
  getUsersOverviewHandler,
  listUsersHandler,
  revealUserFieldsHandler,
  updateUserRoleHandler,
  updateUserStatusHandler
} from '../handlers/users.handlers';

const router = Router();

router.use(requireAdmin);
router.get('/overview', getUsersOverviewHandler);
router.get('/users', listUsersHandler);
router.get('/users/:id', getUserDetailsHandler);
router.post('/users/:id/reveal', requireAdminRecentMfa, revealUserFieldsHandler);
router.patch('/users/:id/role', requireAdminRecentMfa, updateUserRoleHandler);
router.patch('/users/:id/status', requireAdminRecentMfa, updateUserStatusHandler);

export { router as adminUsersRoutes };
