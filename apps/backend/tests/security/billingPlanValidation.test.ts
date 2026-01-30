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

test('checkout rejects FREE and invalid plan codes', async () => {
  const user = await prisma.user.create({
    data: {
      email: `plan-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date()
    }
  });

  await prisma.plan.create({
    data: {
      id: 'plan_free_test',
      code: 'FREE',
      name: 'Free',
      currency: 'EUR',
      amountCents: 0,
      interval: 'month',
      isActive: true,
      features: { projects_limit: 1 }
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const freeRes = await request(app)
    .post('/billing/checkout-session')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ planCode: 'FREE' });

  assert.equal(freeRes.status, 400);
  assert.equal(freeRes.body.error, 'PLAN_INVALID');

  const invalidRes = await request(app)
    .post('/billing/checkout-session')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ planCode: 'BASIC' });

  assert.equal(invalidRes.status, 400);
  assert.equal(invalidRes.body.error, 'VALIDATION_ERROR');
});
