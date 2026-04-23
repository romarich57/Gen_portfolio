import { Router } from 'express';
import { requireAuth } from '../../../middleware/rbac';
import {
  listSessionHistoryHandler,
  listSessionsHandler,
  revokeAllSessionsHandler,
  revokeSessionHandler
} from '../handlers/sessions.handlers';

const router = Router();

router.get('/sessions', requireAuth, listSessionsHandler);
router.get('/sessions/history', requireAuth, listSessionHistoryHandler);
router.post('/sessions/revoke', requireAuth, revokeSessionHandler);
router.post('/sessions/revoke-all', requireAuth, revokeAllSessionsHandler);

export { router as sessionsRoutes };
