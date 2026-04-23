import { Router } from 'express';
import { registrationRoutes } from './routes/registration.routes';
import { sessionRoutes } from './routes/session.routes';
import { passwordRoutes } from './routes/password.routes';
import { phoneRoutes } from './routes/phone.routes';
import { mfaRoutes } from './routes/mfa.routes';
import { oauthRoutes } from './routes/oauth.routes';
import { emailSecurityRoutes } from './routes/email-security.routes';

const router = Router();

router.use(registrationRoutes);
router.use(sessionRoutes);
router.use(passwordRoutes);
router.use(phoneRoutes);
router.use(mfaRoutes);
router.use(oauthRoutes);
router.use(emailSecurityRoutes);

export { router as authModuleRouter };
