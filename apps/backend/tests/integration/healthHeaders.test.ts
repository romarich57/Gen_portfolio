import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';

import { app } from '../../src/app';

test('GET /health includes security headers and request id', async () => {
  const res = await request(app)
    .get('/health')
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 200);
  assert.ok(res.headers['x-request-id']);
  assert.ok(res.headers['content-security-policy']);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.headers['referrer-policy']);
  assert.ok(res.headers['permissions-policy']);
  assert.ok(res.headers['x-frame-options']);
});
