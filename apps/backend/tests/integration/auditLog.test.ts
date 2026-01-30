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
