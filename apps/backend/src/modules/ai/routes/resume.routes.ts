import { Router } from 'express';
import {
  aiUsageHandler,
  grammarResumeAiHandler,
  importResumeAiHandler,
  polishResumeAiHandler
} from '../handlers/resume.handlers';
import { resumeAiImportIpLimiter, resumeAiLimiter } from '../../resumes/shared/rate-limits';

const router = Router();

router.post('/resume/import', resumeAiImportIpLimiter, resumeAiLimiter, importResumeAiHandler);
router.post('/resume/polish', resumeAiLimiter, polishResumeAiHandler);
router.post('/resume/grammar', resumeAiLimiter, grammarResumeAiHandler);
router.get('/usage', resumeAiLimiter, aiUsageHandler);

export { router as aiResumeRoutes };
