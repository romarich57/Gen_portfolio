import { Router } from 'express';
import {
  confirmAssetHandler,
  createResumeHandler,
  deleteAssetHandler,
  deleteResumeHandler,
  duplicateResumeHandler,
  getExportDownloadUrlHandler,
  getExportStatusHandler,
  getResumeHandler,
  importFileHandler,
  importTextHandler,
  issueAssetUploadHandler,
  listResumesHandler,
  requestExportHandler,
  updateResumeHandler
} from '../handlers/resumes.handlers';
import {
  resumeAssetLimiter,
  resumeExportLimiter,
  resumePatchLimiter,
  resumeReadLimiter,
  resumeWriteLimiter
} from '../shared/rate-limits';

const router = Router();

router.get('/', resumeReadLimiter, listResumesHandler);
router.post('/', resumeWriteLimiter, createResumeHandler);
router.post('/import/text', resumeWriteLimiter, importTextHandler);
router.post('/import/file', resumeWriteLimiter, importFileHandler);
router.get('/:id', resumeReadLimiter, getResumeHandler);
router.patch('/:id', resumePatchLimiter, updateResumeHandler);
router.delete('/:id', resumeWriteLimiter, deleteResumeHandler);
router.post('/:id/duplicate', resumeWriteLimiter, duplicateResumeHandler);
router.post('/:id/assets/upload-url', resumeAssetLimiter, issueAssetUploadHandler);
router.post('/:id/assets/confirm', resumeAssetLimiter, confirmAssetHandler);
router.delete('/:id/assets/:assetId', resumeAssetLimiter, deleteAssetHandler);
router.post('/:id/exports', resumeExportLimiter, requestExportHandler);
router.get('/:id/exports/:exportId/status', resumeReadLimiter, getExportStatusHandler);
router.get('/:id/exports/:exportId/download-url', resumeReadLimiter, getExportDownloadUrlHandler);

export { router as resumesRoutes };
