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

test('update security alerts preferences', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'alerts@test.com',
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const res = await agent
    .post('/me/security/alerts')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('x-test-user-id', user.id)
    .send({ email_enabled: true, sms_enabled: false });

  assert.equal(res.status, 200);

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(updated?.securityAlertEmailEnabled, true);
});
