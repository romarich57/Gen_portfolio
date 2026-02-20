import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken };
}

test('register -> email verify -> login with username', async () => {
  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const username = `user.${Date.now()}`;
  const registerRes = await agent
    .post('/auth/register')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({
      email: 'user@example.com',
      password: 'StrongPassw0rd!',
      firstName: 'Test',
      lastName: 'User',
      username,
      nationality: 'FR'
    });

  assert.equal(registerRes.status, 201);
  const emailToken = registerRes.body.test_token as string;
  assert.ok(emailToken);

  const verifyRes = await agent
    .get(`/auth/email/verify?token=${encodeURIComponent(emailToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.confirmation_token);

  const verifyConfirmRes = await agent
    .post('/auth/email/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: verifyRes.body.confirmation_token });

  assert.equal(verifyConfirmRes.status, 200);

  const verifyReplayRes = await agent
    .post('/auth/email/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ confirmation_token: verifyRes.body.confirmation_token });
  assert.equal(verifyReplayRes.status, 400);
  assert.equal(verifyReplayRes.body.error, 'TOKEN_INVALID');

  const { token: loginCsrf } = await getCsrf(agent);
  const loginRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', loginCsrf)
    .send({ identifier: username, password: 'StrongPassw0rd!' });

  assert.equal(loginRes.status, 200);

  const setCookie = loginRes.headers['set-cookie'] || [];
  const hasAccess = setCookie.some((value: string) => value.startsWith('access_token='));
  const hasRefresh = setCookie.some((value: string) => value.startsWith('refresh_token='));
  assert.ok(hasAccess && hasRefresh);
});
