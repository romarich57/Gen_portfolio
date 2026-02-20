import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { findDuplicateEnvKeys } from '../../src/config/env';

test('findDuplicateEnvKeys returns duplicate keys once and in first-seen order', () => {
  const duplicates = findDuplicateEnvKeys([
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'ACCESS_TOKEN_SECRET',
    'MFA_CHALLENGE_SECRET',
    'REFRESH_TOKEN_SECRET'
  ]);

  assert.deepEqual(duplicates, ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']);
});

test('findDuplicateEnvKeys returns empty array when list is unique', () => {
  const duplicates = findDuplicateEnvKeys(['A', 'B', 'C']);
  assert.deepEqual(duplicates, []);
});
