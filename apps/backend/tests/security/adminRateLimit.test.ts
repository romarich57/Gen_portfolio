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

test('admin write limiter blocks ID-variation bypass on same logical endpoint', async () => {
  const adminA = await prisma.user.create({
    data: {
      email: `admin-write-a-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const adminB = await prisma.user.create({
    data: {
      email: `admin-write-b-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const targets = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      prisma.user.create({
        data: {
          email: `target-write-${Date.now()}-${index}@test.com`,
          status: 'active',
          roles: ['user'],
          onboardingCompletedAt: new Date(),
          emailVerifiedAt: new Date()
        }
      })
    )
  );

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  for (let i = 0; i < 4; i += 1) {
    const res = await agent
      .post(`/api/admin/users/${targets[i].id}/reveal`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .set('X-Test-User-Id', adminA.id)
      .set('X-Test-User-Roles', 'admin')
      .send({ fields: ['email'], confirm: 'AFFICHER' });
    assert.equal(res.status, 200);
  }

  const blocked = await agent
    .post(`/api/admin/users/${targets[4].id}/reveal`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('X-Test-User-Id', adminA.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'AFFICHER' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');

  const otherActor = await agent
    .post(`/api/admin/users/${targets[0].id}/reveal`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('X-Test-User-Id', adminB.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'AFFICHER' });
  assert.equal(otherActor.status, 200);
});

test('legacy /admin namespace is covered by admin read limiter', async () => {
  const adminA = await prisma.user.create({
    data: {
      email: `admin-legacy-a-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const adminB = await prisma.user.create({
    data: {
      email: `admin-legacy-b-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  for (let i = 0; i < 8; i += 1) {
    const res = await request(app)
      .get('/admin/security/otp-rate-limits')
      .set('X-Test-User-Id', adminA.id)
      .set('X-Test-User-Roles', 'admin');
    assert.equal(res.status, 200);
  }

  const blocked = await request(app)
    .get('/admin/security/otp-rate-limits')
    .set('X-Test-User-Id', adminA.id)
    .set('X-Test-User-Roles', 'admin');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');

  const otherActor = await request(app)
    .get('/admin/security/otp-rate-limits')
    .set('X-Test-User-Id', adminB.id)
    .set('X-Test-User-Roles', 'admin');
  assert.equal(otherActor.status, 200);
});

test('admin write limiter normalizes percent-encoded dynamic segments', async () => {
  const admin = await prisma.user.create({
    data: {
      email: `admin-encoded-${Date.now()}@test.com`,
      status: 'active',
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  for (let i = 0; i < 4; i += 1) {
    const res = await agent
      .post('/api/admin/users/1/reveal')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .set('X-Test-User-Id', admin.id)
      .set('X-Test-User-Roles', 'admin')
      .send({ fields: ['email'], confirm: 'AFFICHER' });
    assert.equal(res.status, 404);
  }

  const blocked = await agent
    .post('/api/admin/users/%31/reveal')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'AFFICHER' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
});
