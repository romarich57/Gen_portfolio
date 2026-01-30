import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { stripe } from '../../src/services/stripeClient';

test('stripe webhook replay returns 200 no-op', async () => {
  const eventId = `evt_replay_${Date.now()}`;
  const payload = JSON.stringify({
    id: eventId,
    type: 'customer.created',
    data: { object: {} }
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!
  });

  const first = await request(app)
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload);

  assert.equal(first.status, 200);

  const second = await request(app)
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', signature)
    .send(payload);

  assert.equal(second.status, 200);

  const count = await prisma.webhookEvent.count({ where: { eventId } });
  assert.equal(count, 1);
});
