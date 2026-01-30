import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';

async function getCsrf() {
  const res = await request(app).get('/auth/csrf').set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken as string, cookie };
}

test('checkout rate limit triggers after threshold', async () => {
  const user = await prisma.user.create({
    data: {
      email: `limit-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date()
    }
  });

  await prisma.plan.upsert({
    where: { code: 'PREMIUM' },
    update: {},
    create: {
      id: 'plan_premium_test',
      code: 'PREMIUM',
      name: 'Premium',
      currency: 'EUR',
      stripePriceId: 'price_premium_test',
      amountCents: 1000,
      interval: 'month',
      isActive: true,
      features: { projects_limit: 5 }
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  for (let i = 0; i < 3; i += 1) {
    const res = await request(app)
      .post('/billing/checkout-session')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .set('Cookie', cookieHeader)
      .send({ planCode: 'PREMIUM' });
    assert.equal(res.status, 200);
  }

  const blocked = await request(app)
    .post('/billing/checkout-session')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ planCode: 'PREMIUM' });

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
  assert.equal(blocked.body.captcha_required, true);
});
