import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';

test('stripe webhook rejects invalid signature', async () => {
  const payload = JSON.stringify({
    id: 'evt_invalid_sig',
    type: 'invoice.paid',
    data: { object: {} }
  });

  const res = await request(app)
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', 'invalid')
    .send(payload);

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'SIGNATURE_INVALID');
});
