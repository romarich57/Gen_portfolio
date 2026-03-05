import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

test('backup codes regenerate requires recent MFA', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'mfa@test.com',
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user'],
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

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const res = await agent
    .post('/me/mfa/backup-codes/regenerate')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('x-test-user-id', user.id)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.backup_codes.length, 8);
  for (const backupCode of res.body.backup_codes as string[]) {
    assert.match(backupCode, /^[A-Za-z0-9_-]{11}$/);
  }

  const count = await prisma.backupCode.count({ where: { userId: user.id } });
  assert.equal(count, 8);
});
