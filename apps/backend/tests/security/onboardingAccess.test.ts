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

test('users without completed profile cannot access protected routes', async () => {
  const user = await prisma.user.create({
    data: {
      email: `pending-${Date.now()}@example.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: null
    }
  });

  const { token: csrfToken, cookie: csrfCookie } = await getCsrf();
  const accessToken = signAccessToken({ sub: user.id, roles: ['admin'] }, 15);
  const cookieHeader = `${csrfCookie}; access_token=${accessToken}`;

  const res = await request(app)
    .post('/protected/rbac-test')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', csrfToken)
    .set('Cookie', cookieHeader);

  assert.equal(res.status, 403);
});
