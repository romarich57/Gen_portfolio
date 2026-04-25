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

async function createUser() {
  return prisma.user.create({
    data: {
      email: `ai-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      status: 'active',
      roles: ['user'],
      firstName: 'AI',
      lastName: 'User',
      username: `ai${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
      nationality: 'FR',
      onboardingCompletedAt: new Date()
    }
  });
}

test('AI resume import ignores client provider secrets and records usage', async () => {
  const user = await createUser();
  const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
  const { token, cookie } = await getCsrf();

  const res = await request(app)
    .post('/api/ai/resume/import')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', `${cookie}; access_token=${accessToken}`)
    .send({
      text: 'Développeur frontend React avec 5 ans d’expérience.',
      locale: 'fr',
      apiKey: 'should-not-be-accepted',
      model: 'user-choice'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');

  const okRes = await request(app)
    .post('/api/ai/resume/import')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', `${cookie}; access_token=${accessToken}`)
    .send({ text: 'Développeur frontend React avec 5 ans d’expérience.', locale: 'fr' });

  assert.equal(okRes.status, 200);
  assert.equal(okRes.body.resume.basic.title, 'Profil professionnel');

  const usage = await prisma.aiUsageEvent.findMany({ where: { userId: user.id } });
  assert.equal(usage.length, 1);
  assert.equal(usage[0].provider, 'mock');
});
