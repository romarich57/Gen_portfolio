import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { hashPassword } from '../../src/utils/password';
import { resetMfaPolicyCache } from '../../src/services/mfaPolicy';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

async function createUser(params?: { override?: boolean | null }) {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  return prisma.user.create({
    data: {
      email: `mfa-${Date.now()}@example.com`,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user'],
      mfaEnabled: false,
      mfaRequiredOverride: params?.override ?? null,
      onboardingCompletedAt: new Date(),
      firstName: 'Mfa',
      lastName: 'Required',
      username: `mfa_${Date.now()}`,
      nationality: 'FR'
    }
  });
}

afterEach(async () => {
  await prisma.featureFlag.deleteMany({ where: { key: 'mfa_required_global' } });
  resetMfaPolicyCache();
});

test('login requires MFA setup when global flag is enabled', async () => {
  await prisma.featureFlag.create({
    data: { key: 'mfa_required_global', valueBoolean: true }
  });
  resetMfaPolicyCache();

  const user = await createUser();
  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const res = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier: user.email, password: 'StrongPassw0rd!' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'MFA_SETUP_REQUIRED');
  const cookies = res.headers['set-cookie'] as unknown as string[];
  assert.ok(cookies.some((cookie) => cookie.startsWith('onboarding_token=')));
  assert.ok(!cookies.some((cookie) => /^access_token=[^;]+/.test(cookie) && !cookie.startsWith('access_token=;')));
  assert.ok(!cookies.some((cookie) => /^refresh_token=[^;]+/.test(cookie) && !cookie.startsWith('refresh_token=;')));
});

test('login succeeds when user override disables global MFA requirement', async () => {
  await prisma.featureFlag.create({
    data: { key: 'mfa_required_global', valueBoolean: true }
  });
  resetMfaPolicyCache();

  const user = await createUser({ override: false });
  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const res = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier: user.email, password: 'StrongPassw0rd!' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  assert.ok(cookies.some((cookie) => cookie.startsWith('access_token=')));
});
