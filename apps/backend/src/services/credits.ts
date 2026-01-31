import { prisma } from '../db/prisma';

export async function getCreditsSummary(userId: string, limit = 100) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const ledger = await prisma.creditsLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  return {
    balance: user.creditsBalance,
    ledger: ledger.map((entry) => ({
      id: entry.id,
      delta: entry.delta,
      reason: entry.reason,
      created_at: entry.createdAt,
      created_by_admin_id: entry.createdByAdminId
    }))
  };
}

export async function adjustCredits(params: {
  userId: string;
  delta: number;
  reason: string;
  adminId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const nextBalance = user.creditsBalance + params.delta;
    if (nextBalance < 0) {
      throw new Error('CREDITS_INSUFFICIENT');
    }

    await tx.user.update({
      where: { id: params.userId },
      data: { creditsBalance: nextBalance }
    });

    const ledger = await tx.creditsLedger.create({
      data: {
        userId: params.userId,
        delta: params.delta,
        reason: params.reason,
        createdByAdminId: params.adminId ?? null
      }
    });

    return {
      balance: nextBalance,
      ledger
    };
  });
}
