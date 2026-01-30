import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';

import { app } from '../../src/app';

async function getCsrfToken(agent) {
  const res = await agent
    .get('/auth/csrf')
    .set('Origin', 'http://localhost:3000');
  const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  return { token: res.body.csrfToken, cookie };
}

test('Rate limit triggers with captcha_required flag', async () => {
  const agent = request(app);
  const { token, cookie } = await getCsrfToken(agent);

  await agent
    .post('/_test/limited')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie);

  await agent
    .post('/_test/limited')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie);

  const res = await agent
    .post('/_test/limited')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie);

  assert.equal(res.status, 429);
  assert.equal(res.body.error, 'RATE_LIMITED');
  assert.equal(res.body.captcha_required, true);
});
