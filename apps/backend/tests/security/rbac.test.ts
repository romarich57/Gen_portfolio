import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';

import { app } from '../../src/app';

async function getCsrfToken(agent) {
  const res = await agent
    .get('/auth/csrf')
    .set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken, cookie };
}

test('RBAC denies unauthenticated access', async () => {
  const agent = request(app);
  const { token, cookie } = await getCsrfToken(agent);

  const res = await agent
    .post('/protected/rbac-test')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie);

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'AUTH_REQUIRED');
});

test('RBAC denies user without role', async () => {
  const agent = request(app);
  const { token, cookie } = await getCsrfToken(agent);

  const res = await agent
    .post('/protected/rbac-test')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie)
    .set('X-Test-User-Id', 'user-1')
    .set('X-Test-User-Roles', 'user');

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
});

test('RBAC allows admin role', async () => {
  const agent = request(app);
  const { token, cookie } = await getCsrfToken(agent);

  const res = await agent
    .post('/protected/rbac-test')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie)
    .set('X-Test-User-Id', 'admin-1')
    .set('X-Test-User-Roles', 'admin');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
