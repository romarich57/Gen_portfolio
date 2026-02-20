import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { signRefreshToken, verifyRefreshToken } from '../../src/utils/jwt';

test('legacy refresh JWT helpers still perform sign/verify roundtrip', () => {
  const token = signRefreshToken({ sub: 'user-123' }, 7);
  const payload = verifyRefreshToken(token);
  assert.equal(payload.sub, 'user-123');
});

test('legacy refresh JWT verify rejects invalid token', () => {
  assert.throws(() => verifyRefreshToken('not-a-valid-jwt'));
});
