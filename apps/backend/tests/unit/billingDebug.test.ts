import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { env } from '../../src/config/env';
import { mapBillingActionError } from '../../src/modules/billing/services/checkout-portal-change.service';
import { mapCheckoutError } from '../../src/modules/billing/services/plans-status.service';
import { CheckoutError } from '../../src/services/billing';

test('billing debug details are hidden in production', () => {
  const previous = env.isProduction;
  env.isProduction = true;

  try {
    const mapped = mapBillingActionError(new CheckoutError('STRIPE_ERROR', { reason: 'secret-context' }));
    assert.equal(mapped.debug, undefined);
  } finally {
    env.isProduction = previous;
  }
});

test('billing debug details remain available outside production', () => {
  const previous = env.isProduction;
  env.isProduction = false;

  try {
    const mapped = mapCheckoutError(new CheckoutError('STRIPE_ERROR', { reason: 'safe-debug' }));
    assert.deepEqual(mapped.debug, { reason: 'safe-debug' });
  } finally {
    env.isProduction = previous;
  }
});
