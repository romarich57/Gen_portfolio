import { prisma } from '../db/prisma';
import { PlanCode } from '@prisma/client';
import type { PrismaClient, Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaClient;

const DEFAULT_PLAN_LIMITS: Record<PlanCode, number | null> = {
  FREE: 1,
  PREMIUM: 5,
  VIP: null
};

export async function applyEntitlements(params: {
  userId: string;
  planCode: PlanCode;
  periodStart: Date;
  periodEnd: Date;
}, db?: DbClient) {
  const client = db ?? prisma;
  const plan = await client.plan.findFirst({ where: { code: params.planCode } });
  const limit = plan?.projectLimit ?? DEFAULT_PLAN_LIMITS[params.planCode];
  const existing = await client.entitlement.findUnique({ where: { userId: params.userId } });
  const periodChanged =
    !existing ||
    existing.periodStart.getTime() !== params.periodStart.getTime() ||
    existing.periodEnd.getTime() !== params.periodEnd.getTime();

  const projectsUsed = periodChanged ? 0 : existing?.projectsUsed ?? 0;

  return client.entitlement.upsert({
    where: { userId: params.userId },
    update: {
      projectsLimit: limit,
      projectsUsed,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd
    },
    create: {
      userId: params.userId,
      projectsLimit: limit,
      projectsUsed,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd
    }
  });
}

export async function ensureFreeEntitlements(userId: string, db?: DbClient) {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return applyEntitlements({ userId, planCode: PlanCode.FREE, periodStart, periodEnd }, db);
}
