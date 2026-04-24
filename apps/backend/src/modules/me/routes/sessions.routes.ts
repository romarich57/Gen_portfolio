import { Router } from 'express';
import {
  listSessionHistoryHandler,
  listSessionsHandler,
  revokeAllSessionsHandler,
  revokeSessionHandler
} from '../handlers/sessions.handlers';

const router = Router();

router.get('/sessions', listSessionsHandler);
router.get('/sessions/history', listSessionHistoryHandler);
router.post('/sessions/revoke', revokeSessionHandler);
router.post('/sessions/revoke-all', revokeAllSessionsHandler);

export { router as sessionsRoutes };
