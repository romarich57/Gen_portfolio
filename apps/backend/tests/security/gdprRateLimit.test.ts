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

async function createUserWithMfa() {
  const user = await prisma.user.create({
    data: {
      email: `gdpr-limit-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      firstName: 'Rate',
      lastName: 'Limit',
      username: `gdpr_limit_${Date.now()}`,
      nationality: 'FR',
      mfaEnabled: true
    }
  });

  await prisma.mfaFactor.create({
    data: {
      userId: user.id,
      type: 'totp',
      secretEncrypted: 'test-secret',
      enabledAt: new Date(),
      lastUsedAt: new Date()
    }
  });

  return user;
}

test('gdpr export request rate limit blocks after threshold', async () => {
  const user = await createUserWithMfa();
  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  for (let i = 0; i < 2; i += 1) {
    const res = await request(app)
      .post('/me/gdpr/export/request')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .set('Cookie', cookieHeader)
      .send({});
    assert.equal(res.status, 200);
  }

  const blocked = await request(app)
    .post('/me/gdpr/export/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({});

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
  assert.equal(blocked.body.captcha_required, true);
});
