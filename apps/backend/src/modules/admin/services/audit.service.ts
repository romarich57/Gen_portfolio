import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { decodeCursor, encodeCursor } from '../../../utils/pagination';
import { applyCursorFilter, dateRangeFilter } from '../shared/helpers';

export async function listAuditLogs(query: {
  userId?: string | undefined;
  action_type?: string | undefined;
  created_from?: string | undefined;
  created_to?: string | undefined;
  limit: number;
  cursor?: string | undefined;
}) {
  let where: Prisma.AuditLogWhereInput = {};
  if (query.userId) {
    where.OR = [{ actorUserId: query.userId }, { targetId: query.userId }];
  }
  if (query.action_type) {
    where.action = query.action_type;
  }
  const range = dateRangeFilter(query.created_from, query.created_to);
  if (range) {
    where.timestamp = range;
  }

  where = applyCursorFilter(where, decodeCursor(query.cursor), 'timestamp');
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: query.limit + 1
  });

  const hasMore = logs.length > query.limit;
  const items = (hasMore ? logs.slice(0, query.limit) : logs).map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    actor_user_id: log.actorUserId,
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    metadata: log.metadata
  }));
  const nextLog = hasMore ? logs[query.limit] : null;
  const nextCursor = nextLog ? encodeCursor({ createdAt: nextLog.timestamp, id: nextLog.id }) : null;

  return { items, nextCursor };
}
