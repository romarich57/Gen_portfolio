import { AuthAttemptType } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { requestExport, getExportDownloadUrl } from '../../../services/gdprExport';
import { requestDeletion } from '../../../services/gdprDeletion';
import { recordAuthAttempt } from '../../../services/authAttempts';
import { revokeAllSessions } from '../../../services/session';
import { evaluateExportCaptcha } from '../shared/service-helpers';

export async function requestGdprExportForUser(params: {
  userId: string;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  captchaToken?: string | undefined;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const captchaCheck = await evaluateExportCaptcha({
    email: user.email,
    ip: params.ip ?? null,
    captchaToken: params.captchaToken
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    await recordAuthAttempt({
      type: AuthAttemptType.gdpr_export,
      email: user.email,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      success: false,
      userId: params.userId
    });
    throw new Error('CAPTCHA_REQUIRED');
  }

  const exportRecord = await requestExport({ userId: params.userId });

  await recordAuthAttempt({
    type: AuthAttemptType.gdpr_export,
    email: user.email,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    success: true,
    userId: params.userId
  });

  return exportRecord;
}

export async function getGdprExportStatusForUser(params: { userId: string; exportId: string }) {
  const exportRecord = await prisma.gdprExport.findFirst({
    where: { id: params.exportId, userId: params.userId }
  });

  if (!exportRecord) {
    throw new Error('NOT_FOUND');
  }

  return exportRecord;
}

export async function issueGdprExportDownloadUrlForUser(params: { userId: string; exportId: string }) {
  try {
    return await getExportDownloadUrl({
      exportId: params.exportId,
      userId: params.userId
    });
  } catch {
    throw new Error('EXPORT_NOT_AVAILABLE');
  }
}

export async function requestAccountDeletionForUser(userId: string) {
  const deletionRequest = await requestDeletion(userId);
  await revokeAllSessions(userId);
  return deletionRequest;
}
