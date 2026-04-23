import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../middleware/rbac';
import {
  changePlanHandler,
  createCheckoutSessionHandler,
  createPortalSessionHandler
} from '../handlers/checkout-portal-change.handlers';
import { checkoutIpLimiter, checkoutUserLimiter, portalLimiter } from '../shared/rate-limits';

const router = Router();

router.post(
  '/checkout-session',
  requireAuth,
  requirePermission('billing:checkout'),
  checkoutIpLimiter,
  checkoutUserLimiter,
  createCheckoutSessionHandler
);
router.post(
  '/change-plan',
  requireAuth,
  requirePermission('billing:checkout'),
  checkoutIpLimiter,
  checkoutUserLimiter,
  changePlanHandler
);
router.post('/portal', requireAuth, requirePermission('billing:portal'), portalLimiter, createPortalSessionHandler);
router.post('/portal-session', requireAuth, requirePermission('billing:portal'), portalLimiter, createPortalSessionHandler);

export { router as billingCheckoutPortalChangeRoutes };
