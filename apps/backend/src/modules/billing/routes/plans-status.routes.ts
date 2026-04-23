import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../middleware/rbac';
import {
  getBillingStatusHandler,
  listPlansHandler,
  syncCheckoutSessionHandler
} from '../handlers/plans-status.handlers';

const router = Router();

router.get('/plans', requireAuth, requirePermission('billing:read'), listPlansHandler);
router.get('/status', requireAuth, requirePermission('billing:read'), getBillingStatusHandler);
router.post('/sync-session', requireAuth, requirePermission('billing:read'), syncCheckoutSessionHandler);

export { router as billingPlansStatusRoutes };
