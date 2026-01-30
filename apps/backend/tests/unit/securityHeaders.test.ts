import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { cspDirectives } from '../../src/middleware/securityHeaders';

test('CSP includes core directives', () => {
  assert.ok(cspDirectives.objectSrc.includes("'none'"));
  assert.ok(cspDirectives.baseUri.includes("'self'"));
  assert.ok(cspDirectives.frameAncestors.includes("'none'"));
});
