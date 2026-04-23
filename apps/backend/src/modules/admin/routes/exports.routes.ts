import { Router } from 'express';
import { requireAdmin } from '../../../middleware/adminAuth';
import {
  listExportsHandler,
  purgeUserDeletionHandler,
  requestUserDeletionHandler,
  requestUserExportHandler
} from '../handlers/exports.handlers';

const router = Router();

router.use(requireAdmin);
router.post('/users/:id/gdpr/export', requestUserExportHandler);
router.post('/users/:id/delete', requestUserDeletionHandler);
router.post('/users/:id/purge', purgeUserDeletionHandler);
router.get('/exports', listExportsHandler);

export { router as adminExportsRoutes };
