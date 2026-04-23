import type { Request, Response } from 'express';
import { writeAuditLog } from '../../../services/audit';
import {
  clearAuthCookies,
  clearMfaChallengeCookie,
  clearOnboardingCookie
} from '../../../utils/cookies';
import { gdprExportSchema } from '../schemas/gdpr.schema';
import { requireUserId } from '../shared/http';
import {
  getGdprExportStatusForUser,
  issueGdprExportDownloadUrlForUser,
  requestAccountDeletionForUser,
  requestGdprExportForUser
} from '../services/gdpr.service';

function resolveExportId(req: Request) {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

export async function requestGdprExportHandler(req: Request, res: Response) {
  const parseResult = gdprExportSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const exportRecord = await requestGdprExportForUser({
      userId,
      ip: req.ip ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      captchaToken: parseResult.data.captchaToken
    });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'GDPR_EXPORT_REQUESTED',
      targetType: 'gdpr_export',
      targetId: exportRecord.id,
      metadata: {},
      requestId: req.id
    });

    res.json({ export_id: exportRecord.id, status: exportRecord.status, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function getGdprExportStatusHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const exportId = resolveExportId(req);
  if (!exportId) {
    res.status(400).json({ error: 'EXPORT_NOT_FOUND', request_id: req.id });
    return;
  }

  try {
    const exportRecord = await getGdprExportStatusForUser({ userId, exportId });
    res.json({ status: exportRecord.status, error_message: exportRecord.errorMessage, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function getGdprExportDownloadUrlHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const exportId = resolveExportId(req);
  if (!exportId) {
    res.status(400).json({ error: 'EXPORT_NOT_FOUND', request_id: req.id });
    return;
  }

  try {
    const { url, exportRecord } = await issueGdprExportDownloadUrlForUser({ userId, exportId });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'GDPR_EXPORT_DOWNLOAD_URL_ISSUED',
      targetType: 'gdpr_export',
      targetId: exportRecord.id,
      metadata: {},
      requestId: req.id
    });

    res.json({ download_url: url, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'EXPORT_NOT_AVAILABLE') {
      res.status(400).json({ error: 'EXPORT_NOT_AVAILABLE', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function requestDeletionHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const deletionRequest = await requestAccountDeletionForUser(userId);
  clearAuthCookies(res);
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'GDPR_DELETION_REQUESTED',
    targetType: 'deletion_request',
    targetId: deletionRequest.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ status: deletionRequest.status, request_id: req.id });
}
