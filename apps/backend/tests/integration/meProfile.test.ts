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

test('GET /me requires auth', async () => {
  const res = await request(app).get('/me');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'AUTH_REQUIRED');
});

test('GET /me returns profile for authenticated user', async () => {
  const user = await prisma.user.create({
    data: {
      email: `me-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      firstName: 'Me',
      lastName: 'User',
      username: `me${Date.now()}`,
      nationality: 'FR'
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);

  const res = await request(app).get('/me').set('Cookie', `access_token=${accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.email, user.email);
});

test('PATCH /me rejects invalid username', async () => {
  const user = await prisma.user.create({
    data: {
      email: `me-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      firstName: 'Bad',
      lastName: 'User',
      username: `bad${Date.now()}`,
      nationality: 'FR',
      onboardingCompletedAt: new Date()
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const res = await request(app)
    .patch('/me')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ username: 'bad name' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.fields));
  assert.ok(res.body.fields.includes('username'));
});
