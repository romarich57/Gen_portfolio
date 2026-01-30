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

async function createOnboardedUser() {
  return prisma.user.create({
    data: {
      email: `stepup-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      firstName: 'Step',
      lastName: 'Up',
      username: `stepup_${Date.now()}`,
      nationality: 'FR'
    }
  });
}

test('gdpr export requires recent MFA step-up', async () => {
  const user = await createOnboardedUser();
  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const res = await request(app)
    .post('/me/gdpr/export/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({});

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'MFA_STEP_UP_REQUIRED');
});

test('gdpr delete requires recent MFA step-up', async () => {
  const user = await createOnboardedUser();
  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const res = await request(app)
    .post('/me/gdpr/delete/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({});

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'MFA_STEP_UP_REQUIRED');
});
