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
      email: `avatar-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      firstName: 'Test',
      lastName: 'User',
      username: `user_${Date.now()}`,
      nationality: 'FR'
    }
  });
}

test('avatar upload url and confirm succeeds', async () => {
  const user = await createOnboardedUser();
  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const uploadRes = await request(app)
    .post('/me/avatar/upload-url')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ mime_type: 'image/png', size_bytes: 1024 });

  assert.equal(uploadRes.status, 200);
  assert.ok(uploadRes.body.file_id);

  const confirmRes = await request(app)
    .post('/me/avatar/confirm')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ file_id: uploadRes.body.file_id });

  assert.equal(confirmRes.status, 200);
});

test('avatar upload rejects invalid size and mime', async () => {
  const user = await createOnboardedUser();
  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const tooLarge = await request(app)
    .post('/me/avatar/upload-url')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ mime_type: 'image/png', size_bytes: 3 * 1024 * 1024 });

  assert.equal(tooLarge.status, 400);

  const invalidType = await request(app)
    .post('/me/avatar/upload-url')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({ mime_type: 'image/svg+xml', size_bytes: 1024 });

  assert.equal(invalidType.status, 400);
});
