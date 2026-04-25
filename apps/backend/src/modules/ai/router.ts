import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/rbac';
import { aiResumeRoutes } from './routes/resume.routes';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('ai:resume:use'));
router.use(aiResumeRoutes);

export { router as aiModuleRouter };
