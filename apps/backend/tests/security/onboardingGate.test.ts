import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { OAuthProvider } from '@prisma/client';

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

test('onboarding gate blocks access to billing checkout', async () => {
  const user = await prisma.user.create({
    data: {
      email: `gate-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const res = await request(app)
    .post('/billing/checkout-session')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ planCode: 'PREMIUM' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'ONBOARDING_REQUIRED');
});

test('onboarding gate blocks oauth user with missing fields', async () => {
  const user = await prisma.user.create({
    data: {
      email: `oauth-gate-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  await prisma.oAuthAccount.create({
    data: {
      provider: OAuthProvider.google,
      providerUserId: `google-${Date.now()}`,
      userId: user.id
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const res = await request(app)
    .post('/billing/checkout-session')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ planCode: 'PREMIUM' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'ONBOARDING_REQUIRED');
});
