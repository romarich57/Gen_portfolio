import { Router } from 'express';
import { stripeWebhooksRoutes } from '../../modules/billing/routes/stripe-webhooks.routes';

const router = Router();

router.use(stripeWebhooksRoutes);

export { router as webhookRouter };
