import { Router } from 'express';
import { stripeWebhookHandler } from '../handlers/stripe-webhooks.handlers';

const router = Router();

router.post('/stripe', stripeWebhookHandler);

export { router as stripeWebhooksRoutes };
