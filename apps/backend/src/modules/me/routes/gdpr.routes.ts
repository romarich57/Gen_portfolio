import { Router } from 'express';
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

router.post('/gdpr/export/request', requireRecentMfa, gdprExportLimiter, requestGdprExportHandler);
router.get('/gdpr/export/:id/status', getGdprExportStatusHandler);
router.get('/gdpr/export/:id/download-url', getGdprExportDownloadUrlHandler);
router.post('/gdpr/delete/request', requireRecentMfa, requestDeletionHandler);

export { router as gdprRoutes };
