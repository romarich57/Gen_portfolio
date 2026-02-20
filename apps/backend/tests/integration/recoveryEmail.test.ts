import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { hashPassword } from '../../src/utils/password';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

test('recovery email request and verify flow', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  const user = await prisma.user.create({
    data: {
      email: 'recovery@test.com',
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const requestRes = await agent
    .post('/me/recovery-email')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('x-test-user-id', user.id)
    .send({ email: 'backup@test.com', password: 'StrongPassw0rd!' });

  assert.equal(requestRes.status, 200);
  const recoveryToken = requestRes.body.test_token as string;
  assert.ok(recoveryToken);

  const verifyRes = await agent
    .get(`/auth/recovery-email/verify?token=${encodeURIComponent(recoveryToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.confirmation_token);

  const confirmRes = await agent
    .post('/auth/recovery-email/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: verifyRes.body.confirmation_token });

  assert.equal(confirmRes.status, 200);

  const replayRes = await agent
    .post('/auth/recovery-email/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: verifyRes.body.confirmation_token });

  assert.equal(replayRes.status, 400);
  assert.equal(replayRes.body.error, 'TOKEN_INVALID');

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(updated?.recoveryEmail, 'backup@test.com');
  assert.ok(updated?.recoveryEmailVerifiedAt);
});
