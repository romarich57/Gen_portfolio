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

test('CSRF blocks state-changing request without origin', async () => {
  const res = await request(app).post('/_test/state-change');
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'CSRF_ORIGIN_MISSING');
});

test('CSRF blocks state-changing request with missing token', async () => {
  const res = await request(app)
    .post('/_test/state-change')
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'CSRF_TOKEN_INVALID');
});

test('CSRF allows request with valid token and origin', async () => {
  const agent = request(app);
  const { token, cookie } = await getCsrfToken(agent);

  const res = await agent
    .post('/_test/state-change')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookie)
    .send({ ok: true });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
