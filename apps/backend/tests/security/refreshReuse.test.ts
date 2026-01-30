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
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken, cookie };
}

test('refresh reuse detection revokes sessions', async () => {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  const user = await prisma.user.create({
    data: {
      email: 'reuse@example.com',
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

  const loginRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier: user.email, password: 'StrongPassw0rd!' });

  assert.equal(loginRes.status, 200);

  const refreshCookie = loginRes.headers['set-cookie']?.find((value: string) => value.startsWith('refresh_token='));
  assert.ok(refreshCookie);
  const oldRefreshCookie = refreshCookie!.split(';')[0];

  const { token: refreshCsrf } = await getCsrf(agent);

  const refreshRes = await agent
    .post('/auth/refresh')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', refreshCsrf);

  assert.equal(refreshRes.status, 200);

  const agent2 = request.agent(app);
  const { token: reuseCsrf, cookie: reuseCsrfCookie } = await getCsrf(agent2);

  const reuseRes = await request(app)
    .post('/auth/refresh')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', reuseCsrf)
    .set('Cookie', `${oldRefreshCookie}; ${reuseCsrfCookie}`);

  assert.equal(reuseRes.status, 401);
  assert.equal(reuseRes.body.error, 'REFRESH_REUSE_DETECTED');
});
