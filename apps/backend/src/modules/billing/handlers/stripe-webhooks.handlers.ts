import type { Request, Response } from 'express';
import { processStripeEvent, toStripeEvent } from '../services/stripe-webhooks.service';

export async function stripeWebhookHandler(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'SIGNATURE_MISSING' });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'INVALID_PAYLOAD' });
    return;
  }

  try {
    const event = toStripeEvent(req.body, signature);
    const result = await processStripeEvent(event);

    if (result.duplicate) {
      res.status(200).json({ received: true });
      return;
    }

    if (result.outcome.status === 'failed' && result.outcome.errorMessage === 'PROCESSING_ERROR') {
      res.status(500).json({ received: false, error: 'PROCESSING_ERROR' });
      return;
    }

    res.status(200).json({ received: true });
  } catch {
    res.status(400).json({ error: 'SIGNATURE_INVALID' });
  }
}
