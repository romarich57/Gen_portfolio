import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { PlanCode, Currency, BillingInterval, UserStatus } from '@prisma/client';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return res.body.csrfToken as string;
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

test('admin authz denies non-admin', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'user@test.com',
      status: UserStatus.active,
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  const res = await request(app)
    .get('/api/admin/overview')
    .set('X-Test-User-Id', user.id)
    .set('X-Test-User-Roles', 'user');

  assert.equal(res.status, 403);
});

test('admin users list pagination works', async () => {
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      status: UserStatus.active,
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  for (let i = 0; i < 3; i += 1) {
    await prisma.user.create({
      data: {
        email: `user${i}@test.com`,
        status: UserStatus.active,
        roles: ['user'],
        onboardingCompletedAt: new Date(),
        emailVerifiedAt: new Date()
      }
    });
  }

  const res1 = await request(app)
    .get('/api/admin/users?limit=2')
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin');

  assert.equal(res1.status, 200);
  assert.equal(res1.body.items.length, 2);
  assert.ok(res1.body.nextCursor);

  const res2 = await request(app)
    .get(`/api/admin/users?limit=2&cursor=${encodeURIComponent(res1.body.nextCursor)}`)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin');

  assert.equal(res2.status, 200);
  assert.ok(res2.body.items.length >= 1);
});

test('reveal sensitive requires confirmation and audits', async () => {
  const admin = await prisma.user.create({
    data: {
      email: 'admin2@test.com',
      status: UserStatus.active,
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const user = await prisma.user.create({
    data: {
      email: 'reveal@test.com',
      status: UserStatus.active,
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  await addRecentMfaFactor(admin.id);

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);

  const bad = await agent
    .post(`/api/admin/users/${user.id}/reveal`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', csrf)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'NON' });

  assert.equal(bad.status, 403);

  const ok = await agent
    .post(`/api/admin/users/${user.id}/reveal`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', csrf)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'AFFICHER' });

  assert.equal(ok.status, 200);
  assert.equal(ok.body.email_full, user.email);

  const audit = await prisma.auditLog.findFirst({ where: { action: 'ADMIN_REVEAL_SENSITIVE' } });
  assert.ok(audit);
});

test('admin sensitive mutation is blocked without recent MFA', async () => {
  const admin = await prisma.user.create({
    data: {
      email: 'admin-step-up@test.com',
      status: UserStatus.active,
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  const user = await prisma.user.create({
    data: {
      email: 'reveal-no-step-up@test.com',
      status: UserStatus.active,
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);

  const res = await agent
    .post(`/api/admin/users/${user.id}/reveal`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', csrf)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ fields: ['email'], confirm: 'AFFICHER' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'MFA_STEP_UP_REQUIRED');
});

test('admin subscription change updates DB in test mode', async () => {
  const admin = await prisma.user.create({
    data: {
      email: 'admin3@test.com',
      status: UserStatus.active,
      roles: ['admin'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  const plan = await prisma.plan.create({
    data: {
      code: PlanCode.PREMIUM,
      name: 'Premium',
      currency: Currency.EUR,
      amountCents: 1000,
      interval: BillingInterval.month,
      isActive: true
    }
  });

  const user = await prisma.user.create({
    data: {
      email: 'sub@test.com',
      status: UserStatus.active,
      roles: ['user'],
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });
  await addRecentMfaFactor(admin.id);

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);

  const res = await agent
    .post(`/api/admin/users/${user.id}/subscription/change`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', csrf)
    .set('X-Test-User-Id', admin.id)
    .set('X-Test-User-Roles', 'admin')
    .send({ plan_code: plan.code });

  assert.equal(res.status, 200);

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(updated?.roles.includes('premium'));

  const subscription = await prisma.subscription.findFirst({ where: { userId: user.id } });
  assert.ok(subscription);
  assert.equal(subscription?.planCode, PlanCode.PREMIUM);
});
