import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import { recordConsentsHandler } from '../handlers/consents.handlers';

const router = Router();

router.post('/consents', requireAuth, recordConsentsHandler);

export { router as consentsRoutes };
