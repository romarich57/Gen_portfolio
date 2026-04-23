import { Router } from 'express';
import { requireAdmin } from '../../../middleware/adminAuth';
import { getAdminMeHandler } from '../handlers/settings.handlers';

const router = Router();

router.use(requireAdmin);
router.get('/me', getAdminMeHandler);

export { router as adminSettingsRoutes };
