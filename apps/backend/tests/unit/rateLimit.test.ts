import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { buildRateLimitKey } from '../../src/middleware/rateLimit';

test('buildRateLimitKey uses ip, route, and email', () => {
  const req = {
    ip: '127.0.0.1',
    baseUrl: '/auth',
    path: '/login',
    body: { email: 'USER@EXAMPLE.COM' }
  };
  const key = buildRateLimitKey(req);
  assert.equal(key, '127.0.0.1|/auth/login|user@example.com');
});

test('buildRateLimitKey handles missing email', () => {
  const req = {
    ip: '127.0.0.1',
    baseUrl: '/health',
    path: '',
    body: {}
  };
  const key = buildRateLimitKey(req);
  assert.equal(key, '127.0.0.1|/health');
});

test('buildRateLimitKey falls back to identifier', () => {
  const req = {
    ip: '127.0.0.1',
    baseUrl: '/auth',
    path: '/login',
    body: { identifier: 'UserName' }
  };
  const key = buildRateLimitKey(req);
  assert.equal(key, '127.0.0.1|/auth/login|username');
});
