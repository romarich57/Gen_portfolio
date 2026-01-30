import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';
import '../helpers/db';

import { prisma } from '../../src/db/prisma';
import { applyEntitlements } from '../../src/services/entitlements';

function makePeriod(startIso: string, endIso: string) {
  return { periodStart: new Date(startIso), periodEnd: new Date(endIso) };
}

test('applyEntitlements resets usage when period changes', async () => {
  const user = await prisma.user.create({
    data: {
      email: `ent-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  const periodOne = makePeriod('2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z');
  await applyEntitlements({ userId: user.id, planCode: 'PREMIUM', ...periodOne });

  await prisma.entitlement.update({
    where: { userId: user.id },
    data: { projectsUsed: 3 }
  });

  const samePeriod = await applyEntitlements({ userId: user.id, planCode: 'PREMIUM', ...periodOne });
  assert.equal(samePeriod.projectsUsed, 3);

  const periodTwo = makePeriod('2025-02-01T00:00:00.000Z', '2025-03-01T00:00:00.000Z');
  const nextPeriod = await applyEntitlements({ userId: user.id, planCode: 'PREMIUM', ...periodTwo });
  assert.equal(nextPeriod.projectsUsed, 0);
});
