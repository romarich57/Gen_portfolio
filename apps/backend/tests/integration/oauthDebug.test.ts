import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';

import { app } from '../../src/app';

test('oauth debug endpoint is disabled by default', async () => {
  const res = await request(app)
    .get('/auth/oauth/debug')
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'NOT_FOUND');
});
