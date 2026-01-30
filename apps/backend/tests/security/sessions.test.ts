import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { createSession } from '../../src/services/session';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

test('list and revoke sessions', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'sessions@test.com',
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const session = await createSession({
    userId: user.id,
    roles: ['user'],
    ip: '127.0.0.1',
    userAgent: 'test-agent'
  });

  const agent = request.agent(app);
  const listRes = await agent
    .get('/me/sessions')
    .set('x-test-user-id', user.id)
    .set('Cookie', [`refresh_token=${session.refreshToken}`]);

  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.sessions.length, 1);
  assert.equal(listRes.body.sessions[0].current, true);

  const { token } = await getCsrf(agent);
  const revokeRes = await agent
    .post('/me/sessions/revoke')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('x-test-user-id', user.id)
    .send({ session_id: listRes.body.sessions[0].id });

  assert.equal(revokeRes.status, 200);

  const updated = await prisma.session.findUnique({ where: { id: listRes.body.sessions[0].id } });
  assert.ok(updated?.revokedAt);
});
