import { prisma } from '../db/prisma';
import { DeletionRequestStatus, FileStatus, JobType, JobStatus } from '@prisma/client';
import { deleteObject } from './s3';
import { writeAuditLog } from './audit';

const DELETION_DELAY_DAYS = 7;

export async function requestDeletion(userId: string) {
  const existing = await prisma.deletionRequest.findFirst({
    where: { userId, status: { in: [DeletionRequestStatus.requested, DeletionRequestStatus.scheduled] } },
    orderBy: { requestedAt: 'desc' }
  });

  if (existing) {
    return existing;
  }

  const scheduledFor = new Date(Date.now() + DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000);

  const deletionRequest = await prisma.deletionRequest.create({
    data: {
      userId,
      status: DeletionRequestStatus.scheduled,
      requestedAt: new Date(),
      scheduledFor
    }
  });

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() }
  });

  await prisma.job.create({
    data: {
      type: JobType.GDPR_PURGE,
      payloadJson: { userId, deletionRequestId: deletionRequest.id },
      status: JobStatus.queued,
      runAfter: scheduledFor
    }
  });

  return deletionRequest;
}

export async function processDeletionJob(params: { userId: string; deletionRequestId: string }) {
  const now = new Date();
  const deletion = await prisma.deletionRequest.findUnique({ where: { id: params.deletionRequestId } });
  if (!deletion || deletion.status === DeletionRequestStatus.completed) {
    return;
  }

  const files = await prisma.file.findMany({ where: { ownerUserId: params.userId } });
  for (const file of files) {
    try {
      await deleteObject({ bucket: file.bucket, key: file.objectKey });
    } catch {
      // Best-effort purge, continue with DB cleanup
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.file.updateMany({
      where: { ownerUserId: params.userId },
      data: { status: FileStatus.deleted, deletedAt: now }
    });

    await tx.session.updateMany({ where: { userId: params.userId }, data: { revokedAt: now } });
    await tx.mfaFactor.deleteMany({ where: { userId: params.userId } });
    await tx.backupCode.deleteMany({ where: { userId: params.userId } });
    await tx.phoneVerification.deleteMany({ where: { userId: params.userId } });
    await tx.oAuthAccount.deleteMany({ where: { userId: params.userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: params.userId } });
    await tx.recoveryEmailToken.deleteMany({ where: { userId: params.userId } });
    await tx.securityActionToken.deleteMany({ where: { userId: params.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: params.userId } });

    await tx.user.update({
      where: { id: params.userId },
      data: {
        email: `deleted-${params.userId}@example.invalid`,
        passwordHash: null,
        firstName: null,
        lastName: null,
        username: null,
        nationality: null,
        locale: null,
        mfaEnabled: false,
        avatarFileId: null,
        recoveryEmail: null,
        recoveryEmailPending: null,
        recoveryEmailVerifiedAt: null,
        securityAlertEmailEnabled: false,
        securityAlertSmsEnabled: false
      }
    });

    await tx.deletionRequest.update({
      where: { id: params.deletionRequestId },
      data: { status: DeletionRequestStatus.completed, completedAt: now }
    });
  });

  await writeAuditLog({
    actorUserId: params.userId,
    actorIp: null,
    action: 'GDPR_DELETION_COMPLETED',
    targetType: 'deletion_request',
    targetId: params.deletionRequestId,
    metadata: {},
    requestId: null
  });
}
