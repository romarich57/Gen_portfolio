import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';

async function getCsrfToken(agent) {
  const res = await agent
    .get('/auth/csrf')
    .set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken, cookie };
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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

test('RBAC returns 401 when access token is invalid', async () => {
  const agent = request(app);
  const { token, cookie } = await getCsrfToken(agent);

  const res = await agent
    .post('/protected/rbac-test')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', [`access_token=invalid-token`, cookie].join('; '));

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'AUTH_REQUIRED');
});

test('RBAC returns 403 when user is not active', async () => {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail('rbac-banned'),
      status: 'banned',
      roles: ['admin']
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['admin'] }, 15);
  const agent = request(app);

  const res = await agent
    .get('/api/admin/me')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', `access_token=${accessToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
});

test('RBAC returns 403 when user is soft deleted', async () => {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail('rbac-deleted'),
      status: 'active',
      roles: ['admin'],
      deletedAt: new Date()
    }
  });

  const accessToken = signAccessToken({ sub: user.id, roles: ['admin'] }, 15);
  const agent = request(app);

  const res = await agent
    .get('/api/admin/me')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', `access_token=${accessToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
});
