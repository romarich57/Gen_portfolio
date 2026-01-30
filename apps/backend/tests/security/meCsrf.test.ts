import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';

import { app } from '../../src/app';

test('me routes require CSRF token', async () => {
  const res = await request(app)
    .patch('/me')
    .send({ first_name: 'Test' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'CSRF_ORIGIN_MISSING');
});
