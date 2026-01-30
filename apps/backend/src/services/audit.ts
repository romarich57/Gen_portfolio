import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';

type AuditLogInput = {
  actorUserId?: string | null;
  actorIp?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  requestId?: string | null;
};

type DbClient = Prisma.TransactionClient | PrismaClient;

async function writeAuditLog(
  { actorUserId, actorIp, action, targetType, targetId, metadata, requestId }: AuditLogInput,
  db?: DbClient
) {
  const client = db ?? prisma;
  return client.auditLog.create({
    data: {
      actorUserId: actorUserId || null,
      actorIp: actorIp || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      metadata: metadata ?? ({} as Prisma.InputJsonValue),
      requestId: requestId || null
    }
  });
}

export { writeAuditLog };
