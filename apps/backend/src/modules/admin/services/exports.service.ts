import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { requestDeletion, processDeletionJob } from '../../../services/gdprDeletion';
import { requestExport } from '../../../services/gdprExport';
import { decodeCursor, encodeCursor } from '../../../utils/pagination';
import { applyCursorFilter, dateRangeFilter } from '../shared/helpers';

type ActorContext = {
  actorUserId?: string | null | undefined;
  actorIp?: string | null | undefined;
};

export async function requestUserExport(userId: string, actor: ActorContext, requestId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const exportRecord = await requestExport({ userId: user.id });
  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_GDPR_EXPORT_REQUESTED',
    targetType: 'gdpr_export',
    targetId: exportRecord.id,
    metadata: {},
    requestId
  });

  return exportRecord.id;
}

export async function requestUserDeletion(userId: string, actor: ActorContext, requestId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const deletion = await requestDeletion(user.id);
  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_SOFT_DELETE',
    targetType: 'user',
    targetId: user.id,
    metadata: { deletion_id: deletion.id },
    requestId
  });
}

export async function purgeUserDeletion(userId: string, actor: ActorContext, requestId: string) {
  const deletion = await prisma.deletionRequest.findFirst({
    where: { userId },
    orderBy: { requestedAt: 'desc' }
  });
  if (!deletion) {
    throw new Error('NOT_FOUND');
  }
  if (deletion.scheduledFor > new Date()) {
    throw new Error('PURGE_NOT_READY');
  }

  await processDeletionJob({ userId: deletion.userId, deletionRequestId: deletion.id });
  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_PURGE',
    targetType: 'user',
    targetId: deletion.userId,
    metadata: { deletion_id: deletion.id },
    requestId
  });
}

export async function listExports(query: {
  userId?: string | undefined;
  status?: string | undefined;
  created_from?: string | undefined;
  created_to?: string | undefined;
  limit: number;
  cursor?: string | undefined;
}) {
  let where: Prisma.GdprExportWhereInput = {};
  if (query.userId) where.userId = query.userId;
  if (query.status) where.status = query.status as never;
  const range = dateRangeFilter(query.created_from, query.created_to);
  if (range) where.requestedAt = range;

  where = applyCursorFilter(where, decodeCursor(query.cursor), 'requestedAt');
  const exports = await prisma.gdprExport.findMany({
    where,
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1
  });

  const hasMore = exports.length > query.limit;
  const items = (hasMore ? exports.slice(0, query.limit) : exports).map((exp) => ({
    id: exp.id,
    user_id: exp.userId,
    status: exp.status,
    requested_at: exp.requestedAt,
    ready_at: exp.readyAt,
    expires_at: exp.expiresAt
  }));
  const nextExport = hasMore ? exports[query.limit] : null;
  const nextCursor = nextExport ? encodeCursor({ createdAt: nextExport.requestedAt, id: nextExport.id }) : null;

  return { items, nextCursor };
}
