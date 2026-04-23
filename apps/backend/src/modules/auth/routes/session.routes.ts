import { Router } from 'express';
import { loginAccountLimiter, loginIpLimiter, refreshLimiter } from '../shared/rate-limits';
import { loginHandler, logoutHandler, refreshHandler } from '../handlers/session.handlers';

const router = Router();

router.post('/login', loginIpLimiter, loginAccountLimiter, loginHandler);
router.post('/logout', logoutHandler);
router.post('/refresh', refreshLimiter, refreshHandler);

export { router as sessionRoutes };
