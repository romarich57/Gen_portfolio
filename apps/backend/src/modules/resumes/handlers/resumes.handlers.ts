import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { FileKind } from '@prisma/client';
import { writeAuditLog } from '../../../services/audit';
import { requireUserId, sendValidationError } from '../shared/http';
import {
  assetConfirmSchema,
  assetUploadSchema,
  createResumeSchema,
  exportRequestSchema,
  importFileSchema,
  importTextSchema,
  patchResumeSchema
} from '../schemas/resume.schema';
import {
  confirmResumeAsset,
  createResume,
  deleteResumeAsset,
  deleteResume,
  duplicateResume,
  getResume,
  getResumeExport,
  getResumeExportDownloadUrl,
  issueResumeAssetUpload,
  listResumes,
  recordFileImport,
  recordTextImport,
  requestResumeExport,
  updateResume
} from '../services/resumes.service';

export async function listResumesHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  res.json({ resumes: await listResumes(userId), request_id: req.id });
}

export async function createResumeHandler(req: Request, res: Response) {
  const parsed = createResumeSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const data = parsed.data.data as Prisma.InputJsonValue | undefined;
    const resume = await createResume({
      userId,
      title: parsed.data.title,
      locale: parsed.data.locale,
      templateId: parsed.data.template_id,
      data
    });
    await audit(req, userId, 'RESUME_CREATED', resume.id);
    res.status(201).json({ resume, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function getResumeHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;
  try {
    res.json({ resume: await getResume(userId, resumeId), request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function updateResumeHandler(req: Request, res: Response) {
  const parsed = patchResumeSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;

  try {
    const data = parsed.data.data as Prisma.InputJsonValue | undefined;
    const resume = await updateResume({
      userId,
      resumeId,
      expectedVersion: parsed.data.expected_version,
      title: parsed.data.title,
      templateId: parsed.data.template_id,
      data
    });
    await audit(req, userId, 'RESUME_UPDATED', resume.id);
    res.json({ resume, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function deleteResumeHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;
  try {
    await deleteResume(userId, resumeId);
    await audit(req, userId, 'RESUME_DELETED', resumeId);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function duplicateResumeHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;
  try {
    const resume = await duplicateResume(userId, resumeId);
    await audit(req, userId, 'RESUME_DUPLICATED', resume.id, { source_resume_id: resumeId });
    res.status(201).json({ resume, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function issueAssetUploadHandler(req: Request, res: Response) {
  const parsed = assetUploadSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;
  try {
    const { file, uploadUrl } = await issueResumeAssetUpload({
      userId,
      resumeId,
      kind: parsed.data.kind === 'import_source' ? FileKind.import : FileKind.other,
      mimeType: parsed.data.mime_type,
      sizeBytes: parsed.data.size_bytes,
      checksumSha256: parsed.data.checksum_sha256
    });
    await audit(req, userId, 'RESUME_ASSET_UPLOAD_ISSUED', resumeId, { file_id: file.id });
    res.json({ upload_url: uploadUrl, file_id: file.id, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function confirmAssetHandler(req: Request, res: Response) {
  const parsed = assetConfirmSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;
  try {
    const asset = await confirmResumeAsset({
      userId,
      resumeId,
      fileId: parsed.data.file_id,
      kind: parsed.data.kind,
      altText: parsed.data.alt_text
    });
    await audit(req, userId, 'RESUME_ASSET_CONFIRMED', resumeId, { asset_id: asset.id });
    res.json({ asset_id: asset.id, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function deleteAssetHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  const assetId = requireParam(req, res, 'assetId');
  if (!resumeId || !assetId) return;
  try {
    await deleteResumeAsset({ userId, resumeId, assetId });
    await audit(req, userId, 'RESUME_ASSET_DELETED', resumeId, { asset_id: assetId });
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function importTextHandler(req: Request, res: Response) {
  const parsed = importTextSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  const imported = await recordTextImport({
    userId,
    text: parsed.data.text,
    parsedJson: { raw_text: parsed.data.text, locale: parsed.data.locale }
  });
  await audit(req, userId, 'RESUME_IMPORT_REQUESTED', imported.id, { mode: 'text' });
  res.status(201).json({ import_id: imported.id, status: imported.status, request_id: req.id });
}

export async function importFileHandler(req: Request, res: Response) {
  const parsed = importFileSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const imported = await recordFileImport({
      userId,
      fileId: parsed.data.file_id,
      locale: parsed.data.locale
    });
    await audit(req, userId, 'RESUME_IMPORT_REQUESTED', imported.id, { mode: 'file' });
    res.status(202).json({ import_id: imported.id, status: imported.status, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function requestExportHandler(req: Request, res: Response) {
  const parsed = exportRequestSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  if (!resumeId) return;
  try {
    const resumeExport = await requestResumeExport({
      userId,
      resumeId,
      format: parsed.data.format
    });
    await audit(req, userId, 'RESUME_EXPORT_REQUESTED', resumeId, { export_id: resumeExport.id, format: parsed.data.format });
    res.status(201).json({
      export: {
        id: resumeExport.id,
        status: resumeExport.status,
        format: resumeExport.format
      },
      request_id: req.id
    });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function getExportStatusHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  const exportId = requireParam(req, res, 'exportId');
  if (!resumeId || !exportId) return;
  try {
    const resumeExport = await getResumeExport(userId, resumeId, exportId);
    res.json({
      export: {
        id: resumeExport.id,
        status: resumeExport.status,
        format: resumeExport.format,
        expires_at: resumeExport.expiresAt?.toISOString() ?? null
      },
      request_id: req.id
    });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

export async function getExportDownloadUrlHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const resumeId = requireParam(req, res, 'id');
  const exportId = requireParam(req, res, 'exportId');
  if (!resumeId || !exportId) return;
  try {
    const downloadUrl = await getResumeExportDownloadUrl(userId, resumeId, exportId);
    await audit(req, userId, 'RESUME_EXPORT_DOWNLOADED', resumeId, { export_id: exportId });
    res.json({ download_url: downloadUrl, request_id: req.id });
  } catch (error) {
    sendResumeError(res, req.id, error);
  }
}

function sendResumeError(res: Response, requestId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'RESUME_ERROR';
  if (message === 'RESUME_NOT_FOUND' || message === 'RESUME_EXPORT_NOT_FOUND' || message === 'RESUME_ASSET_NOT_FOUND') {
    res.status(404).json({ error: 'NOT_FOUND', request_id: requestId });
    return;
  }
  if (message === 'RESUME_VERSION_CONFLICT') {
    res.status(409).json({ error: 'RESUME_VERSION_CONFLICT', request_id: requestId });
    return;
  }
  if (message === 'RESUME_QUOTA_EXCEEDED') {
    res.status(403).json({ error: 'RESUME_QUOTA_EXCEEDED', request_id: requestId });
    return;
  }
  if (message === 'RESUME_EXPORT_NOT_READY') {
    res.status(409).json({ error: 'RESUME_EXPORT_NOT_READY', request_id: requestId });
    return;
  }
  res.status(400).json({ error: 'RESUME_INVALID', request_id: requestId });
}

function requireParam(req: Request, res: Response, name: string): string | null {
  const value = req.params[name];
  if (typeof value === 'string' && value.length > 0) return value;
  res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
  return null;
}

async function audit(req: Request, userId: string, action: string, targetId: string, metadata: Prisma.InputJsonObject = {}) {
  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action,
    targetType: 'resume',
    targetId,
    metadata,
    requestId: req.id
  });
}
