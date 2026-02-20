import { Router } from 'express';
import { registerRouter } from './register.route';
import { loginRouter } from './login.route';
import { passwordRouter } from './password.route';
import { phoneRouter } from './phone.route';
import { mfaRouter } from './mfa.route';
import { oauthRouter } from './oauth.route';
import { emailRouter } from './email.route';

const router = Router();

router.use(registerRouter);
router.use(loginRouter);
router.use(passwordRouter);
router.use(phoneRouter);
router.use(mfaRouter);
router.use(oauthRouter);
router.use(emailRouter);

export { router as authRouter };
