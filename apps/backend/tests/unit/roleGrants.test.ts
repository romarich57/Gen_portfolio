import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';
import '../helpers/db';

import { prisma } from '../../src/db/prisma';
import { syncRolesForPlan } from '../../src/services/roleGrants';

async function getUserRoles(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.roles ?? [];
}

test('syncRolesForPlan grants and revokes premium/vip', async () => {
  const user = await prisma.user.create({
    data: {
      email: `roles-${Date.now()}@example.com`,
      status: 'active',
      roles: ['user']
    }
  });

  await syncRolesForPlan({ userId: user.id, planCode: 'PREMIUM', reason: 'test' });

  const premiumGrant = await prisma.roleGrant.findFirst({
    where: { userId: user.id, role: 'premium', revokedAt: null }
  });
  assert.ok(premiumGrant);

  let roles = await getUserRoles(user.id);
  assert.ok(roles.includes('premium'));
  assert.ok(!roles.includes('vip'));

  await syncRolesForPlan({ userId: user.id, planCode: 'VIP', reason: 'test' });

  const vipGrant = await prisma.roleGrant.findFirst({
    where: { userId: user.id, role: 'vip', revokedAt: null }
  });
  assert.ok(vipGrant);

  roles = await getUserRoles(user.id);
  assert.ok(roles.includes('vip'));
  assert.ok(!roles.includes('premium'));

  await syncRolesForPlan({ userId: user.id, planCode: 'FREE', reason: 'test' });

  const activeGrants = await prisma.roleGrant.findMany({
    where: { userId: user.id, revokedAt: null }
  });
  assert.equal(activeGrants.length, 0);

  roles = await getUserRoles(user.id);
  assert.ok(!roles.includes('premium'));
  assert.ok(!roles.includes('vip'));
});
