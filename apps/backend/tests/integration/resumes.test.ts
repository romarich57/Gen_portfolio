import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';

async function getCsrf() {
  const res = await request(app).get('/auth/csrf').set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken as string, cookie };
}

async function createUser(prefix: string) {
  return prisma.user.create({
    data: {
      email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      status: 'active',
      roles: ['user'],
      firstName: 'CV',
      lastName: 'User',
      username: `${prefix}${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
      nationality: 'FR',
      onboardingCompletedAt: new Date()
    }
  });
}

function accessCookie(userId: string) {
  return `access_token=${signAccessToken({ sub: userId, roles: ['user'] }, 15)}`;
}

test('resume CRUD enforces owner-only access and optimistic versioning', async () => {
  const owner = await createUser('resumeowner');
  const other = await createUser('resumeother');
  const { token, cookie } = await getCsrf();
  const ownerCookie = `${cookie}; ${accessCookie(owner.id)}`;

  const createRes = await request(app)
    .post('/api/resumes')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', ownerCookie)
    .send({ title: 'CV Test', locale: 'fr' });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.resume.title, 'CV Test');
  assert.equal(createRes.body.resume.version, 1);

  const resumeId = createRes.body.resume.id as string;
  const denied = await request(app).get(`/api/resumes/${resumeId}`).set('Cookie', accessCookie(other.id));
  assert.equal(denied.status, 404);

  const updateRes = await request(app)
    .patch(`/api/resumes/${resumeId}`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', ownerCookie)
    .send({ expected_version: 1, title: 'CV Test modifié' });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.resume.version, 2);

  const conflictRes = await request(app)
    .patch(`/api/resumes/${resumeId}`)
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', ownerCookie)
    .send({ expected_version: 1, title: 'Ancienne version' });

  assert.equal(conflictRes.status, 409);
  assert.equal(conflictRes.body.error, 'RESUME_VERSION_CONFLICT');
});

test('resume state-changing endpoints require CSRF', async () => {
  const res = await request(app).post('/api/resumes').send({ title: 'No CSRF' });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'CSRF_ORIGIN_MISSING');
});
