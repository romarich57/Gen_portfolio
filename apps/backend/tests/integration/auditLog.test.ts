import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { hashPassword } from '../../src/utils/password';
import { hashToken } from '../../src/utils/crypto';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

test('audit log inserts on register', async () => {
  const agent = request.agent(app);
  const { token } = await getCsrf(agent);
  const email = `audit-${Date.now()}@example.com`;

  const res = await agent
    .post('/auth/register')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({
      email,
      password: 'StrongPassw0rd!',
      firstName: 'Audit',
      lastName: 'User',
      username: `audit_${Date.now()}`,
      nationality: 'FR'
    });

  assert.equal(res.status, 201);

  const audit = await prisma.auditLog.findFirst({
    where: { action: 'REGISTER_SUCCESS', targetType: 'user' },
    orderBy: { timestamp: 'desc' }
  });

  assert.ok(audit);
});

test('login failure audit stores identifier hash instead of raw identifier', async () => {
  const email = `audit-login-${Date.now()}@example.com`;
  const passwordHash = await hashPassword('StrongPassw0rd!');
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);
  const identifier = 'AUDIT-LOGIN-USERNAME';

  const loginRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier, password: 'WrongPassw0rd!' });

  assert.equal(loginRes.status, 401);

  const audit = await prisma.auditLog.findFirst({
    where: { action: 'LOGIN_FAIL' },
    orderBy: { timestamp: 'desc' }
  });

  assert.ok(audit);
  const metadata = audit.metadata as Record<string, unknown>;
  assert.equal(metadata.identifier_hash, hashToken(identifier.trim().toLowerCase()));
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, 'identifier'), false);
});
