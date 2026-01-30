import { prisma } from '../db/prisma';
import { PlanCode, RoleType, UserRole } from '@prisma/client';
import type { PrismaClient, Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaClient;

async function updateUserRoles(
  userId: string,
  rolesToAdd: UserRole[],
  rolesToRemove: UserRole[],
  db?: DbClient
) {
  const client = db ?? prisma;
  const user = await client.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const current = new Set(user.roles as UserRole[]);
  rolesToRemove.forEach((role) => current.delete(role));
  rolesToAdd.forEach((role) => current.add(role));
  const nextRoles = Array.from(current);
  if (nextRoles.join('|') === (user.roles as UserRole[]).join('|')) return;
  await client.user.update({
    where: { id: userId },
    data: { roles: nextRoles }
  });
}

export async function grantRole(
  params: { userId: string; role: RoleType; reason: string },
  db?: DbClient
) {
  const client = db ?? prisma;
  const existing = await client.roleGrant.findFirst({
    where: { userId: params.userId, role: params.role, revokedAt: null }
  });
  if (!existing) {
    await client.roleGrant.create({
      data: {
        userId: params.userId,
        role: params.role,
        reason: params.reason
      }
    });
  }

  const userRole = params.role === RoleType.premium ? UserRole.premium : UserRole.vip;
  await updateUserRoles(params.userId, [userRole], [], db);

  return !existing;
}

export async function revokeRole(
  params: { userId: string; role: RoleType; reason: string },
  db?: DbClient
) {
  const client = db ?? prisma;
  const active = await client.roleGrant.findFirst({
    where: { userId: params.userId, role: params.role, revokedAt: null }
  });
  if (active) {
    await client.roleGrant.update({
      where: { id: active.id },
      data: { revokedAt: new Date(), reason: params.reason }
    });
  }

  const userRole = params.role === RoleType.premium ? UserRole.premium : UserRole.vip;
  await updateUserRoles(params.userId, [], [userRole], db);

  return Boolean(active);
}

export async function syncRolesForPlan(
  params: { userId: string; planCode: PlanCode; reason: string },
  db?: DbClient
) {
  const changes = { granted: [] as RoleType[], revoked: [] as RoleType[] };
  if (params.planCode === PlanCode.PREMIUM) {
    if (await grantRole({ userId: params.userId, role: RoleType.premium, reason: params.reason }, db)) {
      changes.granted.push(RoleType.premium);
    }
    if (await revokeRole({ userId: params.userId, role: RoleType.vip, reason: params.reason }, db)) {
      changes.revoked.push(RoleType.vip);
    }
    return changes;
  }

  if (params.planCode === PlanCode.VIP) {
    if (await grantRole({ userId: params.userId, role: RoleType.vip, reason: params.reason }, db)) {
      changes.granted.push(RoleType.vip);
    }
    if (await revokeRole({ userId: params.userId, role: RoleType.premium, reason: params.reason }, db)) {
      changes.revoked.push(RoleType.premium);
    }
    return changes;
  }

  if (await revokeRole({ userId: params.userId, role: RoleType.vip, reason: params.reason }, db)) {
    changes.revoked.push(RoleType.vip);
  }
  if (await revokeRole({ userId: params.userId, role: RoleType.premium, reason: params.reason }, db)) {
    changes.revoked.push(RoleType.premium);
  }

  return changes;
}
