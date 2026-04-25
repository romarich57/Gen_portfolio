import { randomUUID, createHash } from 'crypto';
import { FileKind, FileStatus, ResumeExportStatus, ResumeStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { createPresignedDownload, createPresignedUpload, deleteObject, headObject, putObject } from '../../../services/s3';
import { defaultResumeData } from './default-resume.service';
import { renderResumeMarkdown } from './markdown-export.service';
import { sanitizeResumeData } from './sanitize.service';

type ResumeDataInput = Prisma.InputJsonValue;

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSET_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/json',
  'text/markdown'
]);

function serializeResume(resume: {
  id: string;
  title: string;
  locale: string;
  templateId: string | null;
  status: ResumeStatus;
  dataJson: Prisma.JsonValue;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: resume.id,
    title: resume.title,
    locale: resume.locale,
    template_id: resume.templateId,
    status: resume.status,
    data: resume.dataJson,
    version: resume.version,
    created_at: resume.createdAt.toISOString(),
    updated_at: resume.updatedAt.toISOString()
  };
}

export async function listResumes(userId: string) {
  const resumes = await prisma.resume.findMany({
    where: { ownerUserId: userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' }
  });
  return resumes.map(serializeResume);
}

async function assertResumeLimit(userId: string) {
  const entitlement = await prisma.entitlement.findUnique({ where: { userId } });
  const limit = entitlement?.resumeLimit ?? entitlement?.projectsLimit ?? null;
  if (limit === null) return;

  const count = await prisma.resume.count({
    where: { ownerUserId: userId, deletedAt: null, status: { not: ResumeStatus.deleted } }
  });
  if (count >= limit) {
    throw new Error('RESUME_QUOTA_EXCEEDED');
  }
}

export async function createResume(params: {
  userId: string;
  title?: string | undefined;
  locale: 'fr' | 'en';
  templateId?: string | null | undefined;
  data?: ResumeDataInput | undefined;
}) {
  await assertResumeLimit(params.userId);
  const title = params.title ?? 'Nouveau CV';
  const data = sanitizeResumeData(params.data ?? defaultResumeData(title));

  const resume = await prisma.$transaction(async (tx) => {
    const created = await tx.resume.create({
      data: {
        ownerUserId: params.userId,
        title,
        locale: params.locale,
        templateId: params.templateId ?? null,
        dataJson: data,
        status: ResumeStatus.draft
      }
    });
    await tx.resumeVersion.create({
      data: {
        resumeId: created.id,
        version: created.version,
        dataJson: data,
        checksum: checksumJson(data)
      }
    });
    await tx.entitlement.updateMany({
      where: { userId: params.userId },
      data: { resumesUsed: { increment: 1 }, projectsUsed: { increment: 1 } }
    });
    return created;
  });

  return serializeResume(resume);
}

export async function getOwnedResume(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, ownerUserId: userId, deletedAt: null }
  });
  if (!resume) throw new Error('RESUME_NOT_FOUND');
  return resume;
}

export async function getResume(userId: string, resumeId: string) {
  return serializeResume(await getOwnedResume(userId, resumeId));
}

export async function updateResume(params: {
  userId: string;
  resumeId: string;
  expectedVersion: number;
  title?: string | undefined;
  templateId?: string | null | undefined;
  data?: ResumeDataInput | undefined;
}) {
  const current = await getOwnedResume(params.userId, params.resumeId);
  if (current.version !== params.expectedVersion) {
    throw new Error('RESUME_VERSION_CONFLICT');
  }

  const nextVersion = current.version + 1;
  const data = sanitizeResumeData(params.data ?? (current.dataJson as ResumeDataInput));
  const status = current.status === ResumeStatus.draft ? ResumeStatus.edited : current.status;

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.resume.update({
      where: { id: current.id },
      data: {
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.templateId !== undefined ? { templateId: params.templateId } : {}),
        ...(params.data !== undefined ? { dataJson: data } : {}),
        status,
        version: nextVersion
      }
    });
    await tx.resumeVersion.create({
      data: {
        resumeId: current.id,
        version: nextVersion,
        dataJson: data,
        checksum: checksumJson(data)
      }
    });
    return saved;
  });

  return serializeResume(updated);
}

export async function deleteResume(userId: string, resumeId: string) {
  await getOwnedResume(userId, resumeId);
  await prisma.resume.update({
    where: { id: resumeId },
    data: { status: ResumeStatus.deleted, deletedAt: new Date() }
  });
  await prisma.entitlement.updateMany({
    where: { userId },
    data: { resumesUsed: { decrement: 1 }, projectsUsed: { decrement: 1 } }
  });
}

export async function duplicateResume(userId: string, resumeId: string) {
  const resume = await getOwnedResume(userId, resumeId);
  await assertResumeLimit(userId);
  return createResume({
    userId,
    title: `${resume.title} (copie)`,
    locale: resume.locale === 'en' ? 'en' : 'fr',
    templateId: resume.templateId,
    data: resume.dataJson as ResumeDataInput
  });
}

export async function issueResumeAssetUpload(params: {
  userId: string;
  resumeId: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | undefined;
}) {
  await getOwnedResume(params.userId, params.resumeId);
  validateAssetInput(params.mimeType, params.sizeBytes);

  const objectKey = `resumes/${params.userId}/${params.resumeId}/${randomUUID()}`;
  const file = await prisma.file.create({
    data: {
      ownerUserId: params.userId,
      kind: params.kind,
      bucket: env.s3Bucket,
      objectKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      checksumSha256: params.checksumSha256 ?? null,
      status: FileStatus.pending
    }
  });
  const uploadUrl = await createPresignedUpload({
    bucket: env.s3Bucket,
    key: objectKey,
    contentType: params.mimeType,
    contentLength: params.sizeBytes,
    expiresInSeconds: env.s3PresignPutTtlSeconds
  });
  return { file, uploadUrl };
}

export async function confirmResumeAsset(params: {
  userId: string;
  resumeId: string;
  fileId: string;
  kind: 'photo' | 'certificate' | 'import_source' | 'export' | 'other';
  altText?: string | undefined;
}) {
  await getOwnedResume(params.userId, params.resumeId);
  const file = await prisma.file.findFirst({
    where: { id: params.fileId, ownerUserId: params.userId, status: FileStatus.pending }
  });
  if (!file) throw new Error('RESUME_ASSET_INVALID');

  const head = await headObject({ bucket: file.bucket, key: file.objectKey });
  if (head.contentType !== file.mimeType || (head.contentLength ?? 0) > MAX_ASSET_BYTES) {
    throw new Error('RESUME_ASSET_INVALID');
  }

  const asset = await prisma.$transaction(async (tx) => {
    await tx.file.update({ where: { id: file.id }, data: { status: FileStatus.active } });
    return tx.resumeAsset.create({
      data: {
        resumeId: params.resumeId,
        fileId: file.id,
        kind: params.kind,
        altText: params.altText ?? null
      }
    });
  });

  return asset;
}

export async function deleteResumeAsset(params: { userId: string; resumeId: string; assetId: string }) {
  await getOwnedResume(params.userId, params.resumeId);
  const asset = await prisma.resumeAsset.findFirst({
    where: {
      id: params.assetId,
      resumeId: params.resumeId,
      deletedAt: null,
      resume: { ownerUserId: params.userId, deletedAt: null }
    },
    include: { file: true }
  });
  if (!asset) throw new Error('RESUME_ASSET_NOT_FOUND');

  const deletedAt = new Date();
  await deleteObject({ bucket: asset.file.bucket, key: asset.file.objectKey });
  await prisma.$transaction([
    prisma.resumeAsset.update({ where: { id: asset.id }, data: { deletedAt } }),
    prisma.file.update({
      where: { id: asset.fileId },
      data: { status: FileStatus.deleted, deletedAt }
    })
  ]);
}

export async function requestResumeExport(params: {
  userId: string;
  resumeId: string;
  format: 'pdf' | 'json' | 'markdown' | 'zip';
}) {
  const resume = await getOwnedResume(params.userId, params.resumeId);
  if (params.format === 'pdf' || params.format === 'zip') {
    return prisma.resumeExport.create({
      data: {
        userId: params.userId,
        resumeId: resume.id,
        format: params.format,
        status: ResumeExportStatus.queued
      }
    });
  }

  const body =
    params.format === 'json'
      ? Buffer.from(JSON.stringify(resume.dataJson, null, 2))
      : Buffer.from(renderResumeMarkdown(resume.title, resume.dataJson));
  const mimeType = params.format === 'json' ? 'application/json' : 'text/markdown';
  const objectKey = `exports/${params.userId}/${resume.id}/${randomUUID()}.${params.format === 'json' ? 'json' : 'md'}`;
  await putObject({ bucket: env.s3Bucket, key: objectKey, body, contentType: mimeType });

  return prisma.$transaction(async (tx) => {
    const file = await tx.file.create({
      data: {
        ownerUserId: params.userId,
        kind: FileKind.other,
        bucket: env.s3Bucket,
        objectKey,
        mimeType,
        sizeBytes: body.length,
        status: FileStatus.active
      }
    });
    return tx.resumeExport.create({
      data: {
        userId: params.userId,
        resumeId: resume.id,
        fileId: file.id,
        format: params.format,
        status: ResumeExportStatus.ready,
        readyAt: new Date(),
        expiresAt: new Date(Date.now() + env.s3PresignGetTtlSeconds * 1000)
      }
    });
  });
}

export async function getResumeExport(userId: string, resumeId: string, exportId: string) {
  await getOwnedResume(userId, resumeId);
  const resumeExport = await prisma.resumeExport.findFirst({
    where: { id: exportId, userId, resumeId },
    include: { file: true }
  });
  if (!resumeExport) throw new Error('RESUME_EXPORT_NOT_FOUND');
  return resumeExport;
}

export async function getResumeExportDownloadUrl(userId: string, resumeId: string, exportId: string) {
  const resumeExport = await getResumeExport(userId, resumeId, exportId);
  if (resumeExport.status !== ResumeExportStatus.ready || !resumeExport.file) {
    throw new Error('RESUME_EXPORT_NOT_READY');
  }
  return createPresignedDownload({
    bucket: resumeExport.file.bucket,
    key: resumeExport.file.objectKey,
    expiresInSeconds: env.s3PresignGetTtlSeconds
  });
}

export async function recordTextImport(params: { userId: string; text: string; parsedJson: Prisma.InputJsonValue }) {
  return prisma.resumeImport.create({
    data: {
      userId: params.userId,
      sourceText: params.text.slice(0, 10000),
      parsedJson: params.parsedJson,
      status: 'ready'
    }
  });
}

export async function recordFileImport(params: { userId: string; fileId: string; locale: 'fr' | 'en' }) {
  const file = await prisma.file.findFirst({
    where: { id: params.fileId, ownerUserId: params.userId, status: FileStatus.active }
  });
  if (!file) throw new Error('RESUME_ASSET_INVALID');
  if (!ALLOWED_ASSET_MIME_TYPES.has(file.mimeType)) throw new Error('RESUME_ASSET_INVALID');

  return prisma.resumeImport.create({
    data: {
      userId: params.userId,
      fileId: file.id,
      parsedJson: { file_id: file.id, locale: params.locale },
      status: 'queued'
    }
  });
}

function checksumJson(value: Prisma.InputJsonValue): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateAssetInput(mimeType: string, sizeBytes: number) {
  if (!ALLOWED_ASSET_MIME_TYPES.has(mimeType) || sizeBytes > MAX_ASSET_BYTES) {
    throw new Error('RESUME_ASSET_INVALID');
  }
}
