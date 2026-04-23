import { Router } from 'express';
import { requireAdmin } from '../../../middleware/adminAuth';
import { listAuditLogsHandler } from '../handlers/audit.handlers';

const router = Router();

router.use(requireAdmin);
router.get('/audit', listAuditLogsHandler);

export { router as adminAuditRoutes };
