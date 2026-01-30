import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { isOriginAllowed } from '../../src/middleware/cors';

test('isOriginAllowed allows configured origin', () => {
  assert.equal(isOriginAllowed('http://localhost:3000'), true);
});

test('isOriginAllowed denies unknown origin', () => {
  assert.equal(isOriginAllowed('http://evil.com'), false);
});
