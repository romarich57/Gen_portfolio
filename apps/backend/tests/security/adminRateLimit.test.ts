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

test('admin read limiter applies burst limits per actor', async () => {
  const adminA = await prisma.user.create({
    data: {
      email: `admin-a-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const adminB = await prisma.user.create({
    data: {
      email: `admin-b-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  for (let i = 0; i < 8; i += 1) {
    const res = await request(app)
      .get('/api/admin/me')
      .set('X-Test-User-Id', adminA.id)
      .set('X-Test-User-Roles', 'admin');
    assert.equal(res.status, 200);
  }

  const blocked = await request(app)
    .get('/api/admin/me')
    .set('X-Test-User-Id', adminA.id)
    .set('X-Test-User-Roles', 'admin');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');

  const otherActor = await request(app)
    .get('/api/admin/me')
    .set('X-Test-User-Id', adminB.id)
    .set('X-Test-User-Roles', 'admin');
  assert.equal(otherActor.status, 200);
});

test('admin write limiter applies burst limits on state changing routes', async () => {
  const admin = await prisma.user.create({
    data: {
      email: `admin-write-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const target = await prisma.user.create({
    data: {
      email: `target-write-${Date.now()}@test.com`,
      status: 'active',
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  for (let i = 0; i < 4; i += 1) {
    const res = await agent
      .post(`/api/admin/users/${target.id}/reveal`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .set('X-Test-User-Id', admin.id)
      .set('X-Test-User-Roles', 'admin')
      .send({ fields: ['email'], confirm: 'AFFICHER' });
    assert.equal(res.status, 200);
  }

  const blocked = await agent
    .post(`/api/admin/users/${target.id}/reveal`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'AFFICHER' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
});
