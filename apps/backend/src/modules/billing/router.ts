import { Router } from 'express';
import { billingPlansStatusRoutes } from './routes/plans-status.routes';
import { billingCheckoutPortalChangeRoutes } from './routes/checkout-portal-change.routes';

const router = Router();

router.use(billingPlansStatusRoutes);
router.use(billingCheckoutPortalChangeRoutes);

export { router as billingModuleRouter };
