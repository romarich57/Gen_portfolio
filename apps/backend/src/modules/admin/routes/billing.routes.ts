import { Router } from 'express';
import { requireAdmin, requireAdminRecentMfa, requireSuperAdmin } from '../../../middleware/adminAuth';
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
router.post('/plans', requireAdminRecentMfa, requireSuperAdmin, createPlanHandler);
router.patch('/plans/:planId', requireAdminRecentMfa, requireSuperAdmin, updatePlanHandler);
router.post('/stripe/coupons', requireAdminRecentMfa, requireSuperAdmin, createCouponHandler);
router.post('/users/:id/subscription/change', requireAdminRecentMfa, changeSubscriptionHandler);
router.get('/users/:id/credits', getUserCreditsHandler);
router.post('/users/:id/credits/adjust', requireAdminRecentMfa, adjustUserCreditsHandler);

export { router as adminBillingRoutes };
