import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { stripe } from '../../src/services/stripeClient';

test('stripe webhook returns 500 on retryable processing error', async () => {
  const user = await prisma.user.create({
    data: {
      email: `processing-error-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  const stripeCustomerId = `cus_processing_${Date.now()}`;
  await prisma.stripeCustomer.create({
    data: {
      userId: user.id,
      stripeCustomerId
    }
  });

  const priceId = 'price_processing_error_test';
  await prisma.plan.upsert({
    where: { code: 'PREMIUM' },
    update: { stripePriceId: priceId },
    create: {
      id: 'plan_premium_processing_error',
      code: 'PREMIUM',
      name: 'Premium',
      currency: 'EUR',
      stripePriceId: priceId,
      amountCents: 1000,
      interval: 'month',
      isActive: true,
      features: { projects_limit: 5 }
    }
  });

  const eventId = `evt_processing_error_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: eventId,
    type: 'invoice.paid',
    data: {
      object: {
        id: `in_processing_error_${Date.now()}`,
        currency: 'eur',
        customer: stripeCustomerId,
        subscription: `sub_processing_error_${Date.now()}`,
        amount_paid: 1000,
        payment_intent: `pi_processing_error_${Date.now()}`,
        lines: {
          data: [
            {
              price: { id: priceId, currency: 'eur' },
              period: { start: 'oops', end: now + 30 * 24 * 3600 }
            }
          ]
        },
        period_start: now,
        period_end: now + 30 * 24 * 3600
      }
    }
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!
  });

  const res = await request(app)
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload);

  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'PROCESSING_ERROR');

  const webhookEvent = await prisma.webhookEvent.findUnique({ where: { eventId } });
  assert.equal(webhookEvent?.status, 'failed');
  assert.equal(webhookEvent?.errorMessage, 'PROCESSING_ERROR');
});
