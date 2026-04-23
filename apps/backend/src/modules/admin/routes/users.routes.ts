import { Router } from 'express';
import { requireAdmin } from '../../../middleware/adminAuth';
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
router.post('/users/:id/reveal', revealUserFieldsHandler);
router.patch('/users/:id/role', updateUserRoleHandler);
router.patch('/users/:id/status', updateUserStatusHandler);

export { router as adminUsersRoutes };
