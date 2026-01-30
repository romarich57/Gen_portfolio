import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';
import { runNextJob } from '../../src/services/jobs';

async function getCsrf() {
  const res = await request(app).get('/auth/csrf').set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken as string, cookie };
}

async function createOnboardedUser() {
  return prisma.user.create({
    data: {
      email: `gdpr-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      firstName: 'Test',
      lastName: 'User',
      username: `gdpr_${Date.now()}`,
      nationality: 'FR',
      mfaEnabled: true
    }
  });
}

test('gdpr export request queues job and produces download url', async () => {
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

  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();
  const cookieHeader = `${cookie}; access_token=${accessToken}`;

  const requestRes = await request(app)
    .post('/me/gdpr/export/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookieHeader)
    .send({});

  assert.equal(requestRes.status, 200);
  const exportId = requestRes.body.export_id as string;
  assert.ok(exportId);

  await runNextJob('test-worker');

  const exportRecord = await prisma.gdprExport.findUnique({ where: { id: exportId } });
  assert.equal(exportRecord?.status, 'ready');
  assert.ok(exportRecord?.fileId);

  const downloadRes = await request(app)
    .get(`/me/gdpr/export/${exportId}/download-url`)
    .set('Cookie', cookieHeader);

  assert.equal(downloadRes.status, 200);
  assert.ok(downloadRes.body.download_url);
  assert.ok(downloadRes.body.download_url.includes('expires=120'));
});
