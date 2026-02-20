import { Router } from 'express';
import { profileRouter } from './profile.route';
import { securityRouter } from './security.route';
import { sessionsRouter } from './sessions.route';
import { gdprRouter } from './gdpr.route';
import { emailRouter } from './email.route';
import { avatarRouter } from './avatar.route';

const router = Router();

router.use(profileRouter);
router.use(securityRouter);
router.use(sessionsRouter);
router.use(gdprRouter);
router.use(emailRouter);
router.use(avatarRouter);

export { router as meRouter };
