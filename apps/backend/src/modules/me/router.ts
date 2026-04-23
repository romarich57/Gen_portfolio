import { Router } from 'express';
import { profileRoutes } from './routes/profile.routes';
import { onboardingRoutes } from './routes/onboarding.routes';
import { avatarRoutes } from './routes/avatar.routes';
import { gdprRoutes } from './routes/gdpr.routes';
import { consentsRoutes } from './routes/consents.routes';
import { sessionsRoutes } from './routes/sessions.routes';
import { securityEmailRoutes } from './routes/security-email.routes';

const router = Router();

router.use(profileRoutes);
router.use(onboardingRoutes);
router.use(avatarRoutes);
router.use(gdprRoutes);
router.use(consentsRoutes);
router.use(sessionsRoutes);
router.use(securityEmailRoutes);

export { router as meModuleRouter };
