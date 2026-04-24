import { Router } from 'express';
import {
  completeOnboardingHandler,
  getOnboardingStatusHandler
} from '../handlers/onboarding.handlers';

const router = Router();

router.get('/onboarding', getOnboardingStatusHandler);
router.patch('/onboarding', completeOnboardingHandler);

export { router as onboardingRoutes };
