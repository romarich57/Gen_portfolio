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

test('request id header is preserved when format is valid', async () => {
  const requestId = 'valid_Request-Id_123';
  const res = await request(app)
    .get('/health')
    .set('Origin', 'http://localhost:3000')
    .set('x-request-id', requestId);

  assert.equal(res.status, 200);
  assert.equal(res.headers['x-request-id'], requestId);
});

test('request id header is regenerated when format is invalid', async () => {
  const res = await request(app)
    .get('/health')
    .set('Origin', 'http://localhost:3000')
    .set('x-request-id', 'invalid request id with spaces');

  assert.equal(res.status, 200);
  const returned = res.headers['x-request-id'] as string;
  assert.notEqual(returned, 'invalid request id with spaces');
  assert.match(returned, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
