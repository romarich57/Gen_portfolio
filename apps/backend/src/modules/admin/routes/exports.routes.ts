import { Router } from 'express';
import { requireAdmin, requireAdminRecentMfa } from '../../../middleware/adminAuth';
import {
  listExportsHandler,
  purgeUserDeletionHandler,
  requestUserDeletionHandler,
  requestUserExportHandler
} from '../handlers/exports.handlers';

const router = Router();

router.use(requireAdmin);
router.post('/users/:id/gdpr/export', requireAdminRecentMfa, requestUserExportHandler);
router.post('/users/:id/delete', requireAdminRecentMfa, requestUserDeletionHandler);
router.post('/users/:id/purge', requireAdminRecentMfa, purgeUserDeletionHandler);
router.get('/exports', listExportsHandler);

export { router as adminExportsRoutes };
