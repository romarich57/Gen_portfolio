import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';
import { createSession } from '../../src/services/session';

async function getCsrf() {
  const res = await request(app).get('/auth/csrf').set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken as string, cookie };
}

async function createOnboardedUser() {
  return prisma.user.create({
    data: {
      email: `delete-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      firstName: 'Test',
      lastName: 'User',
      username: `delete_${Date.now()}`,
      nationality: 'FR',
      mfaEnabled: true
    }
  });
}

test('gdpr delete request soft deletes and schedules purge', async () => {
  const user = await createOnboardedUser();
  await prisma.mfaFactor.create({
    data: {
      userId: user.id,
      type: 'totp',
      secretEncrypted: 'test-secret',
      enabledAt: new Date(),
      lastUsedAt: new Date()
    }
  });

  await createSession({ userId: user.id, roles: ['user'] });

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const res = await request(app)
    .post('/me/gdpr/delete/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({});

  assert.equal(res.status, 200);

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(updatedUser?.deletedAt);

  const deletionRequest = await prisma.deletionRequest.findFirst({ where: { userId: user.id } });
  assert.ok(deletionRequest);
  assert.equal(deletionRequest?.status, 'scheduled');

  const job = await prisma.job.findFirst({ where: { type: 'GDPR_PURGE' } });
  assert.ok(job);
  assert.ok(job?.runAfter.getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.session.findMany({ where: { userId: user.id } });
  assert.ok(sessions.every((s) => s.revokedAt));
});
