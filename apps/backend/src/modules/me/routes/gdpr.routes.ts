import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import { requireRecentMfa } from '../../../middleware/stepUp';
import { buildRateLimiter } from '../../../middleware/rateLimit';
import {
  getGdprExportDownloadUrlHandler,
  getGdprExportStatusHandler,
  requestDeletionHandler,
  requestGdprExportHandler
} from '../handlers/gdpr.handlers';

const router = Router();

const gdprExportLimiter = buildRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 2,
  keyGenerator: (req) => req.user?.id ?? 'unknown'
});

router.post('/gdpr/export/request', requireAuth, requireRecentMfa, gdprExportLimiter, requestGdprExportHandler);
router.get('/gdpr/export/:id/status', requireAuth, getGdprExportStatusHandler);
router.get('/gdpr/export/:id/download-url', requireAuth, getGdprExportDownloadUrlHandler);
router.post('/gdpr/delete/request', requireAuth, requireRecentMfa, requestDeletionHandler);

export { router as gdprRoutes };
