import type { AiOperation, AiUsageStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';

export async function recordAiUsage(params: {
  userId: string;
  operation: AiOperation;
  provider: string;
  model: string;
  status: AiUsageStatus;
  inputChars: number;
  imageCount?: number | undefined;
  creditsDebited?: number | undefined;
  latencyMs?: number | undefined;
  errorCode?: string | undefined;
  requestId?: string | undefined;
}) {
  const data: Prisma.AiUsageEventUncheckedCreateInput = {
    userId: params.userId,
    operation: params.operation,
    provider: params.provider,
    model: params.model,
    status: params.status,
    inputChars: params.inputChars,
    imageCount: params.imageCount ?? 0,
    creditsDebited: params.creditsDebited ?? 0
  };
  if (params.latencyMs !== undefined) data.latencyMs = params.latencyMs;
  if (params.errorCode !== undefined) data.errorCode = params.errorCode;
  if (params.requestId !== undefined) data.requestId = params.requestId;

  await prisma.aiUsageEvent.create({
    data
  });
}

export async function getAiUsageSummary(userId: string) {
  const [recent, total] = await Promise.all([
    prisma.aiUsageEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    prisma.aiUsageEvent.count({ where: { userId } })
  ]);

  return {
    total_requests: total,
    recent: recent.map((event) => ({
      id: event.id,
      operation: event.operation,
      provider: event.provider,
      status: event.status,
      credits_debited: event.creditsDebited,
      created_at: event.createdAt.toISOString()
    }))
  };
}
