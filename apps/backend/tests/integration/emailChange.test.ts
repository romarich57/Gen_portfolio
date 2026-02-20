import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { hashPassword } from '../../src/utils/password';
import { signEmailChangeToken } from '../../src/utils/jwt';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

test('email change request then verify updates user email', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  const user = await prisma.user.create({
    data: {
      email: `change-email-${Date.now()}@example.com`,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const newEmail = `updated-${Date.now()}@example.com`;
  const changeRes = await agent
    .post('/me/email')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('x-test-user-id', user.id)
    .send({ newEmail, password: 'StrongPassw0rd!' });

  assert.equal(changeRes.status, 200);
  const verifyToken = changeRes.body.test_token as string;
  assert.ok(verifyToken);

  const verifyRes = await agent
    .get(`/auth/email/change/verify?token=${encodeURIComponent(verifyToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.confirmation_token);

  const confirmRes = await agent
    .post('/auth/email/change/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: verifyRes.body.confirmation_token });

  assert.equal(confirmRes.status, 200);

  const replayRes = await agent
    .post('/auth/email/change/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: verifyRes.body.confirmation_token });
  assert.equal(replayRes.status, 409);
  assert.equal(replayRes.body.error, 'EMAIL_UNAVAILABLE');

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(updatedUser?.email, newEmail);
  assert.ok(updatedUser?.emailVerifiedAt);
});

test('email change verification rejects expired token', async () => {
  const user = await prisma.user.create({
    data: {
      email: `expired-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  const expiredToken = signEmailChangeToken(
    {
      sub: user.id,
      newEmail: `new-expired-${Date.now()}@example.com`,
      type: 'email_change'
    },
    -1
  );

  const res = await request(app)
    .get(`/auth/email/change/verify?token=${encodeURIComponent(expiredToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'TOKEN_EXPIRED');
});

test('email change verification rejects unavailable email', async () => {
  const targetEmail = `already-used-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email: `owner-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });
  await prisma.user.create({
    data: {
      email: targetEmail,
      status: 'active',
      roles: ['user']
    }
  });

  const token = signEmailChangeToken(
    {
      sub: user.id,
      newEmail: targetEmail,
      type: 'email_change'
    },
    60
  );

  const res = await request(app)
    .get(`/auth/email/change/verify?token=${encodeURIComponent(token)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'EMAIL_UNAVAILABLE');
});
