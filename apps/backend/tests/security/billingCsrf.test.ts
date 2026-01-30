import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';

test('billing routes require CSRF token', async () => {
  const checkout = await request(app)
    .post('/billing/checkout-session')
    .send({ planCode: 'PREMIUM' });

  assert.equal(checkout.status, 403);
  assert.equal(checkout.body.error, 'CSRF_ORIGIN_MISSING');

  const portal = await request(app)
    .post('/billing/portal')
    .send({});

  assert.equal(portal.status, 403);
  assert.equal(portal.body.error, 'CSRF_ORIGIN_MISSING');
});
