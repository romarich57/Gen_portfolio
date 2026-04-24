import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { generateRandomToken, hashToken } from '../../src/utils/crypto';
import { hashPassword } from '../../src/utils/password';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

async function addRecentMfaFactor(userId: string) {
  await prisma.mfaFactor.create({
    data: {
      userId,
      type: 'totp',
      secretEncrypted: 'test-secret',
      enabledAt: new Date(),
      lastUsedAt: new Date()
    }
  });
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
  await addRecentMfaFactor(user.id);

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
  assert.equal(replayRes.status, 400);
  assert.equal(replayRes.body.error, 'TOKEN_INVALID');

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
  const verifyToken = generateRandomToken(32);
  const cancelToken = generateRandomToken(32);
  await prisma.emailChangeRequest.create({
    data: {
      userId: user.id,
      oldEmail: user.email,
      newEmail: `new-expired-${Date.now()}@example.com`,
      verifyTokenHash: hashToken(verifyToken),
      cancelTokenHash: hashToken(cancelToken),
      expiresAt: new Date(Date.now() - 60_000)
    }
  });

  const res = await request(app)
    .get(`/auth/email/change/verify?token=${encodeURIComponent(verifyToken)}`)
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
  const verifyToken = generateRandomToken(32);
  const cancelToken = generateRandomToken(32);
  await prisma.emailChangeRequest.create({
    data: {
      userId: user.id,
      oldEmail: user.email,
      newEmail: targetEmail,
      verifyTokenHash: hashToken(verifyToken),
      cancelTokenHash: hashToken(cancelToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });

  const res = await request(app)
    .get(`/auth/email/change/verify?token=${encodeURIComponent(verifyToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'EMAIL_UNAVAILABLE');
});

test('email change cancel invalidates pending request', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  const user = await prisma.user.create({
    data: {
      email: `cancel-email-${Date.now()}@example.com`,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });
  await addRecentMfaFactor(user.id);

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);
  const newEmail = `cancel-target-${Date.now()}@example.com`;

  const changeRes = await agent
    .post('/me/email')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('x-test-user-id', user.id)
    .send({ newEmail, password: 'StrongPassw0rd!' });

  assert.equal(changeRes.status, 200);
  const cancelToken = changeRes.body.test_cancel_token as string;
  assert.ok(cancelToken);

  const cancelBootstrap = await agent
    .get(`/auth/email/change/cancel?token=${encodeURIComponent(cancelToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(cancelBootstrap.status, 200);

  const cancelConfirm = await agent
    .post('/auth/email/change/cancel/confirm')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: cancelBootstrap.body.confirmation_token });

  assert.equal(cancelConfirm.status, 200);

  const verifyReplay = await agent
    .get(`/auth/email/change/verify?token=${encodeURIComponent(changeRes.body.test_token as string)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(verifyReplay.status, 400);
  assert.equal(verifyReplay.body.error, 'TOKEN_INVALID');

  const unchangedUser = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(unchangedUser?.email, user.email);
});
