import { Router } from 'express';
import { requireAdmin, requireSuperAdmin } from '../../../middleware/adminAuth';
import {
  adjustUserCreditsHandler,
  changeSubscriptionHandler,
  createCouponHandler,
  createPlanHandler,
  getUserCreditsHandler,
  listPlansHandler,
  updatePlanHandler
} from '../handlers/billing.handlers';

const router = Router();

router.use(requireAdmin);
router.get('/plans', listPlansHandler);
router.post('/plans', requireSuperAdmin, createPlanHandler);
router.patch('/plans/:planId', requireSuperAdmin, updatePlanHandler);
router.post('/stripe/coupons', requireSuperAdmin, createCouponHandler);
router.post('/users/:id/subscription/change', changeSubscriptionHandler);
router.get('/users/:id/credits', getUserCreditsHandler);
router.post('/users/:id/credits/adjust', adjustUserCreditsHandler);

export { router as adminBillingRoutes };
