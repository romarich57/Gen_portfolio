import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import {
  completeOnboardingHandler,
  getOnboardingStatusHandler
} from '../handlers/onboarding.handlers';

const router = Router();

router.get('/onboarding', requireAuth, getOnboardingStatusHandler);
router.patch('/onboarding', requireAuth, completeOnboardingHandler);

export { router as onboardingRoutes };
