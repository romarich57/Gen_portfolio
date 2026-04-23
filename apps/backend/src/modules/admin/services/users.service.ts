import { SubscriptionStatus, UserStatus, type Prisma, type UserRole } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { getBillingStatus } from '../../../services/billing';
import { decodeCursor, encodeCursor } from '../../../utils/pagination';
import {
  applyCursorFilter,
  buildTimeseries,
  countUsersByRole,
  dateRangeFilter,
  maskEmail,
  resolvePrimaryRole
} from '../shared/helpers';

type ActorContext = {
  actorUserId?: string | null | undefined;
  actorIp?: string | null | undefined;
  actorRoles?: string[] | undefined;
};

type UsersQuery = {
  q?: string | undefined;
  role?: 'user' | 'premium' | 'vip' | 'admin' | 'super_admin' | undefined;
  status?: string | undefined;
  created_from?: string | undefined;
  created_to?: string | undefined;
  limit: number;
  cursor?: string | undefined;
};

export async function getUsersOverview() {
  const [totalUsers, totalFree, totalPremium, totalVip, totalActiveSubs, exports24h] = await Promise.all([
    prisma.user.count(),
    countUsersByRole('user'),
    countUsersByRole('premium'),
    countUsersByRole('vip'),
    prisma.subscription.count({ where: { status: SubscriptionStatus.active } }),
    prisma.gdprExport.count({ where: { requestedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
  ]);

  const signups7 = await buildTimeseries(7, (from, to) =>
    prisma.user.count({ where: { createdAt: { gte: from, lt: to } } })
  );
  const upgrades7 = await buildTimeseries(7, (from, to) =>
    prisma.roleGrant.count({ where: { grantedAt: { gte: from, lt: to }, role: { in: ['premium', 'vip'] } } })
  );
  const churn7 = await buildTimeseries(7, (from, to) =>
    prisma.subscription.count({ where: { status: SubscriptionStatus.canceled, updatedAt: { gte: from, lt: to } } })
  );

  return {
    totals: {
      total_users: totalUsers,
      total_users_free: totalFree,
      total_users_premium: totalPremium,
      total_users_vip: totalVip,
      total_active_subscriptions: totalActiveSubs,
      total_exports_24h: exports24h
    },
    timeseries: {
      signups_per_day: signups7,
      upgrades_per_day: upgrades7,
      churn_per_day: churn7
    }
  };
}

export async function listUsers(query: UsersQuery) {
  let where: Prisma.UserWhereInput = {};

  if (query.q) {
    where.OR = [
      { email: { contains: query.q, mode: 'insensitive' } },
      { username: { contains: query.q, mode: 'insensitive' } }
    ];
  }
  if (query.role) {
    where.roles = { has: query.role as UserRole };
  }
  if (query.status) {
    if (query.status === 'deleted') {
      where.deletedAt = { not: null };
    } else {
      where.status = query.status as UserStatus;
    }
  }

  const dateRange = dateRangeFilter(query.created_from, query.created_to);
  if (dateRange) {
    where.createdAt = dateRange;
  }

  where = applyCursorFilter(where, decodeCursor(query.cursor), 'createdAt');

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1
  });

  const hasMore = users.length > query.limit;
  const items = (hasMore ? users.slice(0, query.limit) : users).map((user) => ({
    id: user.id,
    username: user.username,
    role: resolvePrimaryRole(user.roles),
    status: user.deletedAt ? 'deleted' : user.status,
    created_at: user.createdAt,
    email_masked: maskEmail(user.email),
    flags: { email_verified: Boolean(user.emailVerifiedAt) }
  }));

  const nextItem = hasMore ? users[query.limit] : null;
  const nextCursor = nextItem ? encodeCursor({ createdAt: nextItem.createdAt, id: nextItem.id }) : null;

  return { items, nextCursor };
}

export async function getUserDetails(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const [billing, sessionsCount] = await Promise.all([
    getBillingStatus(user.id),
    prisma.session.count({ where: { userId: user.id, revokedAt: null } })
  ]);

  return {
    id: user.id,
    profile: {
      first_name: user.firstName,
      last_name: user.lastName,
      username: user.username,
      nationality: user.nationality,
      status: user.deletedAt ? 'deleted' : user.status,
      roles: user.roles,
      created_at: user.createdAt,
      email_masked: maskEmail(user.email)
    },
    billing,
    sessions_count: sessionsCount,
    credits_balance: user.creditsBalance,
    flags: {
      email_verified: Boolean(user.emailVerifiedAt),
      phone_verified: Boolean(user.phoneVerifiedAt),
      mfa_enabled: Boolean(user.mfaEnabled),
      deleted: Boolean(user.deletedAt)
    }
  };
}

export async function revealUserFields(
  userId: string,
  fields: string[],
  actor: ActorContext,
  requestId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const response: Record<string, string> = {};
  if (fields.includes('email')) {
    response.email_full = user.email;
  }

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_REVEAL_SENSITIVE',
    targetType: 'user',
    targetId: user.id,
    metadata: { fields },
    requestId
  });

  return response;
}

export async function updateUserRole(
  userId: string,
  desired: UserRole,
  actor: ActorContext,
  requestId: string
) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    throw new Error('NOT_FOUND');
  }

  const actorRoles = actor.actorRoles ?? [];
  const actorIsSuper = actorRoles.includes('super_admin');
  if ((desired === 'admin' || desired === 'super_admin') && !actorIsSuper) {
    throw new Error('FORBIDDEN');
  }
  if (!actorIsSuper && target.roles.some((role) => role === 'admin' || role === 'super_admin')) {
    throw new Error('FORBIDDEN');
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { roles: [desired] }
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_ROLE_CHANGED',
    targetType: 'user',
    targetId: target.id,
    metadata: { role: desired },
    requestId
  });
}

export async function updateUserStatus(
  userId: string,
  action: 'ban' | 'unban' | 'deactivate' | 'reactivate',
  actor: ActorContext,
  requestId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const nextStatus = action === 'ban' || action === 'deactivate' ? UserStatus.banned : UserStatus.active;
  await prisma.user.update({
    where: { id: user.id },
    data: { status: nextStatus }
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_STATUS_CHANGED',
    targetType: 'user',
    targetId: user.id,
    metadata: { status_action: action, status: nextStatus },
    requestId
  });
}
