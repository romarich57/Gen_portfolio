import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';

import { app } from '../../src/app';

test('CORS blocks non-allowlisted origin', async () => {
  const res = await request(app)
    .get('/health')
    .set('Origin', 'http://evil.com');

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'CORS_ORIGIN_DENIED');
});
