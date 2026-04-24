import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { FileKind, FileStatus, GdprExportStatus, JobType, JobStatus } from '@prisma/client';
import { putObject, createPresignedDownload } from './s3';
import { writeAuditLog } from './audit';
import { ZipFile } from 'yazl';

const EXPORT_TTL_HOURS = 24;

function buildReadme() {
  return [
    'GDPR Export',
    '',
    'This archive contains your data in JSON format.',
    'Files: data.json, README.txt'
  ].join('\n');
}

async function buildZipBuffer(payload: object): Promise<Buffer> {
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify(payload, null, 2)), 'data.json');
  zip.addBuffer(Buffer.from(buildReadme()), 'README.txt');
  zip.end();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    zip.outputStream.on('data', (chunk) => chunks.push(chunk));
    zip.outputStream.on('error', (err) => reject(err));
    zip.outputStream.on('end', () => resolve());
  });

  return Buffer.concat(chunks);
}

async function buildExportPayload(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const consents = await prisma.consent.findMany({ where: { userId }, orderBy: { consentedAt: 'desc' } });
  const subscriptions = await prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const entitlements = await prisma.entitlement.findUnique({ where: { userId } });
  const roleGrants = await prisma.roleGrant.findMany({ where: { userId }, orderBy: { grantedAt: 'desc' } });
  const payments = await prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const oauthAccounts = await prisma.oAuthAccount.findMany({ where: { userId }, orderBy: { linkedAt: 'desc' } });
  const files = await prisma.file.findMany({ where: { ownerUserId: userId } });

  return {
    generated_at: new Date().toISOString(),
    user: user
      ? {
          id: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          username: user.username,
          nationality: user.nationality,
          locale: user.locale,
          roles: user.roles,
          status: user.status,
          onboarding_completed_at: user.onboardingCompletedAt,
          deleted_at: user.deletedAt,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }
      : null,
    consents,
    subscriptions,
    entitlements,
    role_grants: roleGrants,
    payments,
    oauth_accounts: oauthAccounts,
    files: files.map((file) => ({
      id: file.id,
      kind: file.kind,
      status: file.status,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      created_at: file.createdAt,
      deleted_at: file.deletedAt
    }))
  };
}

export async function requestExport(params: { userId: string }) {
  const existing = await prisma.gdprExport.findFirst({
    where: {
      userId: params.userId,
      status: { in: [GdprExportStatus.queued, GdprExportStatus.building, GdprExportStatus.ready] }
    },
    orderBy: { requestedAt: 'desc' }
  });

  if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
    return existing;
  }

  const exportRecord = await prisma.gdprExport.create({
    data: {
      userId: params.userId,
      status: GdprExportStatus.queued
    }
  });

  await prisma.job.create({
    data: {
      type: JobType.GDPR_EXPORT,
      payloadJson: { exportId: exportRecord.id },
      status: JobStatus.queued,
      runAfter: new Date()
    }
  });

  return exportRecord;
}

export async function processExportJob(params: { exportId: string }) {
  const exportRecord = await prisma.gdprExport.findUnique({ where: { id: params.exportId } });
  if (!exportRecord || exportRecord.status === GdprExportStatus.ready) {
    return;
  }

  await prisma.gdprExport.update({
    where: { id: params.exportId },
    data: { status: GdprExportStatus.building }
  });

  const payload = await buildExportPayload(exportRecord.userId);
  const buffer = await buildZipBuffer(payload);
  const objectKey = `exports/${exportRecord.userId}/${exportRecord.id}.zip`;

  await putObject({
    bucket: env.s3Bucket,
    key: objectKey,
    body: buffer,
    contentType: 'application/zip'
  });

  const file = await prisma.file.create({
    data: {
      ownerUserId: exportRecord.userId,
      kind: FileKind.gdpr_export,
      bucket: env.s3Bucket,
      objectKey,
      mimeType: 'application/zip',
      sizeBytes: buffer.length,
      status: FileStatus.active
    }
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_HOURS * 60 * 60 * 1000);

  await prisma.gdprExport.update({
    where: { id: exportRecord.id },
    data: {
      status: GdprExportStatus.ready,
      fileId: file.id,
      readyAt: now,
      expiresAt
    }
  });

  await writeAuditLog({
    actorUserId: exportRecord.userId,
    actorIp: null,
    action: 'GDPR_EXPORT_READY',
    targetType: 'gdpr_export',
    targetId: exportRecord.id,
    metadata: { file_id: file.id },
    requestId: null
  });
}

export async function getExportDownloadUrl(params: { exportId: string; userId: string }) {
  const exportRecord = await prisma.gdprExport.findFirst({
    where: { id: params.exportId, userId: params.userId }
  });

  if (!exportRecord) {
    throw new Error('EXPORT_NOT_FOUND');
  }

  if (exportRecord.status !== GdprExportStatus.ready || !exportRecord.fileId) {
    throw new Error('EXPORT_NOT_READY');
  }

  if (exportRecord.expiresAt && exportRecord.expiresAt < new Date()) {
    await prisma.gdprExport.update({
      where: { id: exportRecord.id },
      data: { status: GdprExportStatus.expired }
    });
    throw new Error('EXPORT_EXPIRED');
  }

  const file = await prisma.file.findUnique({ where: { id: exportRecord.fileId } });
  if (!file || file.status !== FileStatus.active) {
    throw new Error('EXPORT_FILE_MISSING');
  }

  const url = await createPresignedDownload({
    bucket: file.bucket,
    key: file.objectKey,
    expiresInSeconds: env.s3PresignGetTtlSeconds
  });

  return { url, exportRecord };
}
