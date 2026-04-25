import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/rbac';
import { resumesRoutes } from './routes/resumes.routes';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('resume:write'));
router.use(resumesRoutes);

export { router as resumesModuleRouter };
