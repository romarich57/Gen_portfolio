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
  return { token: res.body.csrfToken };
}

test('login returns neutral error for unknown user and wrong password', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  await prisma.user.create({
    data: {
      email: 'enum@example.com',
      passwordHash,
      status: 'active',
      mfaEnabled: false,
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const unknownRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ email: 'unknown@example.com', password: 'StrongPassw0rd!' });

  const wrongRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ email: 'enum@example.com', password: 'WrongPassw0rd!' });

  assert.equal(unknownRes.status, 401);
  assert.equal(wrongRes.status, 401);
  assert.equal(unknownRes.body.error, 'INVALID_CREDENTIALS');
  assert.equal(wrongRes.body.error, 'INVALID_CREDENTIALS');
});

test('password reset request returns neutral response', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  await prisma.user.create({
    data: {
      email: 'reset@example.com',
      passwordHash,
      status: 'active',
      mfaEnabled: false,
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const existingRes = await agent
    .post('/auth/password/reset/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ email: 'reset@example.com' });

  const unknownRes = await agent
    .post('/auth/password/reset/request')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ email: 'missing@example.com' });

  assert.equal(existingRes.status, 200);
  assert.equal(unknownRes.status, 200);
  assert.equal(existingRes.body.message, unknownRes.body.message);
});
