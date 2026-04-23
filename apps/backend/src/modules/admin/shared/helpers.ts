import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../../db/prisma';

const ROLE_ORDER: UserRole[] = ['super_admin', 'admin', 'vip', 'premium', 'user'];

export function resolvePrimaryRole(roles: UserRole[] | string[]): UserRole {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return 'user';
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const localSafe = local.length <= 2 ? `${local[0] ?? ''}***` : `${local.slice(0, 2)}***`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const domainSuffix = domainParts.slice(1).join('.') || '';
  const domainSafe = domainName.length <= 2 ? `${domainName[0] ?? ''}***` : `${domainName.slice(0, 2)}***`;
  return `${localSafe}@${domainSafe}${domainSuffix ? `.${domainSuffix}` : ''}`;
}

export function adminMeResponse(user: { id: string; email: string; roles: UserRole[] }) {
  return {
    admin: {
      id: user.id,
      email_masked: maskEmail(user.email),
      role: resolvePrimaryRole(user.roles)
    },
    ui: {
      lang: 'fr'
    }
  };
}

export function dateRangeFilter(from?: string | undefined, to?: string | undefined) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) {
      range.gte = parsed;
    }
  }
  if (to) {
    const parsed = new Date(to);
    if (!Number.isNaN(parsed.getTime())) {
      range.lte = parsed;
    }
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

export async function countUsersByRole(role: UserRole) {
  return prisma.user.count({ where: { roles: { has: role } } });
}

export async function buildTimeseries(days: number, query: (from: Date, to: Date) => Promise<number>) {
  const results: Array<{ date: string; value: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i + 1));
    const value = await query(start, end);
    results.push({ date: start.toISOString().slice(0, 10), value });
  }
  return results;
}

export function applyCursorFilter<T extends Prisma.UserWhereInput | Prisma.AuditLogWhereInput | Prisma.GdprExportWhereInput>(
  where: T,
  cursorPayload: { createdAt: Date; id: string } | null,
  timestampField: 'createdAt' | 'timestamp' | 'requestedAt'
) {
  if (!cursorPayload) {
    return where;
  }

  const andFilters = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  return {
    ...where,
    AND: [
      ...andFilters,
      {
        OR: [
          { [timestampField]: { lt: cursorPayload.createdAt } },
          { [timestampField]: cursorPayload.createdAt, id: { lt: cursorPayload.id } }
        ]
      }
    ]
  } as T;
}
