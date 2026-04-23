import { Router } from 'express';
import { issueCsrfToken } from '../../../middleware/csrf';
import { registerLimiter } from '../shared/rate-limits';
import { registerHandler } from '../handlers/registration.handlers';

const router = Router();

router.get('/csrf', issueCsrfToken);
router.post('/register', registerLimiter, registerHandler);

export { router as registrationRoutes };
