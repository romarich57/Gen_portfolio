import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { stripe } from '../../src/services/stripeClient';

test('invoice.paid grants role and updates entitlements', async () => {
  const user = await prisma.user.create({
    data: {
      email: `billing-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  const priceId = 'price_premium_test';
  await prisma.plan.upsert({
    where: { code: 'PREMIUM' },
    update: { stripePriceId: priceId },
    create: {
      id: 'plan_premium_test',
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

  const stripeCustomerId = `cus_${Date.now()}`;
  await prisma.stripeCustomer.create({
    data: {
      userId: user.id,
      stripeCustomerId
    }
  });

  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: `evt_invoice_paid_${Date.now()}`,
    type: 'invoice.paid',
    data: {
      object: {
        id: `in_${Date.now()}`,
        currency: 'eur',
        customer: stripeCustomerId,
        subscription: `sub_${Date.now()}`,
        amount_paid: 1000,
        payment_intent: `pi_${Date.now()}`,
        lines: {
          data: [
            {
              price: { id: priceId },
              period: { start: now, end: now + 30 * 24 * 3600 }
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

  assert.equal(res.status, 200);

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(updatedUser?.roles.includes('premium'));

  const entitlement = await prisma.entitlement.findUnique({ where: { userId: user.id } });
  assert.equal(entitlement?.projectsLimit, 5);
  assert.equal(entitlement?.projectsUsed, 0);

  const subscription = await prisma.subscription.findFirst({ where: { userId: user.id } });
  assert.equal(subscription?.planCode, 'PREMIUM');
});
