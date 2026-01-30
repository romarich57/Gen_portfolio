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

test('login rate limit blocks after threshold', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  const email = `limit-${Date.now()}@example.com`;
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
      mfaRequiredOverride: false,
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  for (let i = 0; i < 5; i += 1) {
    const res = await agent
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .send({ identifier: email, password: 'StrongPassw0rd!' });
    assert.equal(res.status, 200);
  }

  const blocked = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier: email, password: 'StrongPassw0rd!' });

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
});
