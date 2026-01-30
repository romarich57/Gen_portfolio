import { prisma } from '../db/prisma';
import { JobStatus, JobType, GdprExportStatus, DeletionRequestStatus } from '@prisma/client';
import { processExportJob } from './gdprExport';
import { processDeletionJob } from './gdprDeletion';

const MAX_JOB_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

function computeBackoffMs(attempt: number) {
  const base = BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(MAX_BACKOFF_MS, base);
}

function safeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'JOB_FAILED';
}

async function processJob(job: { type: JobType; payloadJson: unknown }) {
  if (job.type === JobType.GDPR_EXPORT) {
    const payload = job.payloadJson as { exportId?: string };
    if (!payload.exportId) {
      throw new Error('INVALID_EXPORT_PAYLOAD');
    }
    await processExportJob({ exportId: payload.exportId });
    return;
  }

  if (job.type === JobType.GDPR_PURGE) {
    const payload = job.payloadJson as { userId?: string; deletionRequestId?: string };
    if (!payload.userId || !payload.deletionRequestId) {
      throw new Error('INVALID_PURGE_PAYLOAD');
    }
    await processDeletionJob({ userId: payload.userId, deletionRequestId: payload.deletionRequestId });
    return;
  }

  throw new Error('UNSUPPORTED_JOB');
}

export async function runNextJob(workerId = `worker-${process.pid}`) {
  const now = new Date();
  const job = await prisma.job.findFirst({
    where: {
      status: JobStatus.queued,
      runAfter: { lte: now },
      lockedAt: null
    },
    orderBy: { createdAt: 'asc' }
  });

  if (!job) return null;

  const updated = await prisma.job.updateMany({
    where: { id: job.id, status: JobStatus.queued, lockedAt: null },
    data: {
      status: JobStatus.running,
      lockedAt: now,
      lockedBy: workerId,
      attempts: { increment: 1 }
    }
  });

  if (updated.count === 0) return null;

  const attempt = job.attempts + 1;

  try {
    await processJob({ type: job.type, payloadJson: job.payloadJson });
    await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.succeeded, lastError: null }
    });
  } catch (err) {
    const errorMessage = safeError(err);
    const shouldRetry = attempt < MAX_JOB_ATTEMPTS;

    if (job.type === JobType.GDPR_EXPORT) {
      const payload = job.payloadJson as { exportId?: string };
      if (payload.exportId) {
        await prisma.gdprExport.update({
          where: { id: payload.exportId },
          data: shouldRetry
            ? { status: GdprExportStatus.queued }
            : { status: GdprExportStatus.failed, errorMessage }
        });
      }
    }

    if (job.type === JobType.GDPR_PURGE) {
      const payload = job.payloadJson as { deletionRequestId?: string };
      if (payload.deletionRequestId) {
        await prisma.deletionRequest.update({
          where: { id: payload.deletionRequestId },
          data: shouldRetry
            ? { status: DeletionRequestStatus.scheduled }
            : { status: DeletionRequestStatus.failed, errorMessage }
        });
      }
    }

    if (shouldRetry) {
      const runAfter = new Date(Date.now() + computeBackoffMs(attempt));
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.queued,
          runAfter,
          lockedAt: null,
          lockedBy: null,
          lastError: errorMessage
        }
      });
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.failed, lastError: errorMessage }
      });
    }
  }

  return job;
}
