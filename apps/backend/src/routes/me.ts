import { Router } from 'express';
import { z } from 'zod';
import { Prisma, AuthAttemptType, ConsentSource } from '@prisma/client';
import { requireAuth } from '../middleware/rbac';
import { requireRecentMfa } from '../middleware/stepUp';
import { buildRateLimiter } from '../middleware/rateLimit';
import { prisma } from '../db/prisma';
import { writeAuditLog } from '../services/audit';
import { getProfile, updateProfile, completeOnboarding, getOnboardingStatus } from '../services/profile';
import { issueAvatarUpload, confirmAvatarUpload } from '../services/avatar';
import { requestExport, getExportDownloadUrl } from '../services/gdprExport';
import { requestDeletion } from '../services/gdprDeletion';
import { recordConsent } from '../services/consents';
import { countRecentFailures, recordAuthAttempt } from '../services/authAttempts';
import { verifyCaptchaToken } from '../services/captcha';
import { revokeAllSessions, revokeSession } from '../services/session';
import { formatZodError } from '../utils/validation';
import { normalizeUsername, normalizeEmail } from '../utils/normalize';
import { getIpLocation } from '../utils/ipLocation';
import { verifyPassword, hashPassword } from '../utils/password';
import { signEmailChangeToken } from '../utils/jwt';
import { env } from '../config/env';
import { sendEmail, buildEmailHtml, buildEmailText } from '../services/email';
import { hashToken, generateRandomToken, hashBackupCode } from '../utils/crypto';
import { REFRESH_COOKIE_NAME } from '../config/auth';
import {
  clearAuthCookies,
  clearOnboardingCookie,
  clearMfaChallengeCookie
} from '../utils/cookies';

const router = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

const profileSchema = z.object({
  first_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }).optional(),
  last_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }).optional(),
  username: z.string().regex(USERNAME_REGEX, { message: 'username_invalid' }).optional(),
  nationality: z.string().regex(/^[A-Za-z]{2}$/, { message: 'country_invalid' }).optional(),
  locale: z.string().min(2, { message: 'min' }).max(10, { message: 'max' }).optional()
});

const onboardingSchema = z.object({
  first_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }),
  last_name: z.string().min(1, { message: 'required' }).max(64, { message: 'max' }),
  username: z.string().regex(USERNAME_REGEX, { message: 'username_invalid' }),
  nationality: z.string().regex(/^[A-Za-z]{2}$/, { message: 'country_invalid' })
});

const avatarUploadSchema = z.object({
  mime_type: z.string().min(3).max(120),
  size_bytes: z.number().int().positive()
});

const avatarConfirmSchema = z.object({
  file_id: z.string().uuid()
});

const consentSchema = z.object({
  analytics_enabled: z.boolean(),
  ads_enabled: z.boolean(),
  consent_version: z.string().min(2).max(20),
  source: z.nativeEnum(ConsentSource)
});

const gdprExportSchema = z.object({
  captchaToken: z.string().optional()
});

const recoveryEmailSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().optional()
});

const recoveryEmailRemoveSchema = z.object({
  password: z.string().optional()
});

const securityAlertsSchema = z.object({
  email_enabled: z.boolean(),
  sms_enabled: z.boolean()
});

const sessionRevokeSchema = z.object({
  session_id: z.string().min(8)
});

const sessionsRevokeAllSchema = z.object({
  include_current: z.boolean().optional()
});

const avatarLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user?.id ?? 'unknown'
});

const gdprExportLimiter = buildRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 2,
  keyGenerator: (req) => req.user?.id ?? 'unknown'
});

const recoveryEmailLimiter = buildRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => req.user?.id ?? 'unknown'
});

async function ensureRecentMfaIfEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true }
  });
  if (!user || !user.mfaEnabled) return true;

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null } },
    orderBy: { lastUsedAt: 'desc' }
  });

  if (!factor || !factor.lastUsedAt) return false;

  const maxAgeMs = env.reauthMaxHours * 60 * 60 * 1000;
  return Date.now() - factor.lastUsedAt.getTime() <= maxAgeMs;
}

async function enforceExportCaptcha(params: { email: string; ip?: string | null; captchaToken?: string }) {
  const failures = await countRecentFailures({
    type: AuthAttemptType.gdpr_export,
    email: params.email,
    ip: params.ip ?? null,
    windowMinutes: 60
  });

  if (failures < 2) return { required: false, valid: true };
  const valid = await verifyCaptchaToken(params.captchaToken, params.ip ?? undefined);
  return { required: true, valid };
}

async function ensureUsernameAvailable(params: { userId: string; username: string }) {
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: params.username, mode: 'insensitive' },
      NOT: { id: params.userId }
    }
  });
  return !existing;
}

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const profile = await getProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  res.json({ profile, request_id: req.id });
});

router.get('/onboarding', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const status = await getOnboardingStatus(userId);
  if (!status) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  res.json({ ...status, request_id: req.id });
});

router.patch('/onboarding', requireAuth, async (req, res) => {
  const parseResult = onboardingSchema.safeParse(req.body);
  if (!parseResult.success) {
    const formatted = formatZodError(parseResult.error);
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      fields: formatted.fields,
      issues: formatted.issues,
      request_id: req.id
    });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const desiredUsername = normalizeUsername(parseResult.data.username);
  const usernameAvailable = await ensureUsernameAvailable({ userId, username: desiredUsername });
  if (!usernameAvailable) {
    res.status(409).json({ error: 'USERNAME_UNAVAILABLE', request_id: req.id });
    return;
  }

  try {
    await completeOnboarding({
      userId,
      data: {
        firstName: parseResult.data.first_name.trim(),
        lastName: parseResult.data.last_name.trim(),
        username: desiredUsername,
        nationality: parseResult.data.nationality.toUpperCase()
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'USERNAME_UNAVAILABLE', request_id: req.id });
      return;
    }
    throw err;
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'ONBOARDING_COMPLETED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.patch('/', requireAuth, async (req, res) => {
  const parseResult = profileSchema.safeParse(req.body);
  if (!parseResult.success) {
    const formatted = formatZodError(parseResult.error);
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      fields: formatted.fields,
      issues: formatted.issues,
      request_id: req.id
    });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const data: {
      firstName?: string;
      lastName?: string;
      username?: string;
      nationality?: string;
      locale?: string;
    } = {};

    if (parseResult.data.first_name !== undefined) data.firstName = parseResult.data.first_name.trim();
    if (parseResult.data.last_name !== undefined) data.lastName = parseResult.data.last_name.trim();
    if (parseResult.data.username !== undefined) {
      const desiredUsername = normalizeUsername(parseResult.data.username);
      const available = await ensureUsernameAvailable({ userId, username: desiredUsername });
      if (!available) {
        res.status(409).json({ error: 'USERNAME_UNAVAILABLE', request_id: req.id });
        return;
      }
      data.username = desiredUsername;
    }
    if (parseResult.data.nationality !== undefined) data.nationality = parseResult.data.nationality.toUpperCase();
    if (parseResult.data.locale !== undefined) data.locale = parseResult.data.locale;

    await updateProfile({
      userId,
      data
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'USERNAME_UNAVAILABLE', request_id: req.id });
      return;
    }
    throw err;
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'PROFILE_UPDATED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/avatar/upload-url', requireAuth, avatarLimiter, async (req, res) => {
  const parseResult = avatarUploadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const { file, uploadUrl } = await issueAvatarUpload({
      userId,
      mimeType: parseResult.data.mime_type,
      sizeBytes: parseResult.data.size_bytes
    });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'AVATAR_UPLOAD_URL_ISSUED',
      targetType: 'file',
      targetId: file.id,
      metadata: {},
      requestId: req.id
    });

    res.json({ upload_url: uploadUrl, file_id: file.id, request_id: req.id });
  } catch (err) {
    res.status(400).json({ error: 'AVATAR_INVALID', request_id: req.id });
  }
});

router.post('/avatar/confirm', requireAuth, async (req, res) => {
  const parseResult = avatarConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const file = await confirmAvatarUpload({ userId, fileId: parseResult.data.file_id });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'AVATAR_SET_ACTIVE',
      targetType: 'file',
      targetId: file.id,
      metadata: {},
      requestId: req.id
    });

    res.json({ ok: true, request_id: req.id });
  } catch (err) {
    res.status(400).json({ error: 'AVATAR_INVALID', request_id: req.id });
  }
});

router.post('/gdpr/export/request', requireAuth, requireRecentMfa, gdprExportLimiter, async (req, res) => {
  const parseResult = gdprExportSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const captchaCheck = await enforceExportCaptcha({
    email: user.email,
    ip: req.ip ?? null,
    ...(parseResult.data.captchaToken ? { captchaToken: parseResult.data.captchaToken } : {})
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    await recordAuthAttempt({
      type: AuthAttemptType.gdpr_export,
      email: user.email,
      ip: req.ip ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      success: false,
      userId
    });

    res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
    return;
  }

  const exportRecord = await requestExport({ userId });

  await recordAuthAttempt({
    type: AuthAttemptType.gdpr_export,
    email: user.email,
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    success: true,
    userId
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
});

router.get('/gdpr/export/:id/status', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const exportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!exportId) {
    res.status(400).json({ error: 'EXPORT_NOT_FOUND', request_id: req.id });
    return;
  }

  const exportRecord = await prisma.gdprExport.findFirst({
    where: { id: exportId, userId }
  });

  if (!exportRecord) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  res.json({ status: exportRecord.status, error_message: exportRecord.errorMessage, request_id: req.id });
});

router.get('/gdpr/export/:id/download-url', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const exportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!exportId) {
    res.status(400).json({ error: 'EXPORT_NOT_FOUND', request_id: req.id });
    return;
  }

  try {
    const { url, exportRecord } = await getExportDownloadUrl({ exportId, userId });

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
  } catch (err) {
    res.status(400).json({ error: 'EXPORT_NOT_AVAILABLE', request_id: req.id });
  }
});

router.post('/gdpr/delete/request', requireAuth, requireRecentMfa, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const deletionRequest = await requestDeletion(userId);
  await revokeAllSessions(userId);
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
});

router.post('/consents', requireAuth, async (req, res) => {
  const parseResult = consentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  await recordConsent({
    userId,
    analyticsEnabled: parseResult.data.analytics_enabled,
    adsEnabled: parseResult.data.ads_enabled,
    consentVersion: parseResult.data.consent_version,
    source: parseResult.data.source,
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'CONSENTS_UPDATED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

// ============================================
// Sessions & Security Settings
// ============================================
router.get('/sessions', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const refreshHash = refreshToken ? hashToken(refreshToken) : null;
  const currentSession = refreshHash
    ? await prisma.session.findUnique({ where: { refreshTokenHash: refreshHash } })
    : null;

  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' }
  });

  res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      created_at: session.createdAt,
      last_used_at: session.lastUsedAt,
      expires_at: session.expiresAt,
      ip: session.ip,
      user_agent: session.userAgent,
      location: getIpLocation(session.ip),
      current: currentSession?.id === session.id
    })),
    request_id: req.id
  });
});

router.get('/sessions/history', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const refreshHash = refreshToken ? hashToken(refreshToken) : null;
  const currentSession = refreshHash
    ? await prisma.session.findUnique({ where: { refreshTokenHash: refreshHash } })
    : null;

  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
    take: 25
  });

  const now = Date.now();
  res.json({
    sessions: sessions.map((session) => {
      let status: 'active' | 'revoked' | 'expired' = 'active';
      if (session.revokedAt) status = 'revoked';
      else if (session.expiresAt.getTime() <= now) status = 'expired';
      const location = getIpLocation(session.ip);
      return {
        id: session.id,
        created_at: session.createdAt,
        last_used_at: session.lastUsedAt,
        expires_at: session.expiresAt,
        revoked_at: session.revokedAt,
        rotated_at: session.rotatedAt,
        replaced_by_session_id: session.replacedBySessionId,
        ip: session.ip,
        user_agent: session.userAgent,
        device_fingerprint: session.deviceFingerprint,
        location,
        current: currentSession?.id === session.id,
        status
      };
    }),
    request_id: req.id
  });
});

router.post('/sessions/revoke', requireAuth, async (req, res) => {
  const parseResult = sessionRevokeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { id: parseResult.data.session_id, userId }
  });
  if (!session) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  await revokeSession(session.id);

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const refreshHash = refreshToken ? hashToken(refreshToken) : null;
  const currentSession = refreshHash
    ? await prisma.session.findUnique({ where: { refreshTokenHash: refreshHash } })
    : null;

  if (currentSession?.id === session.id) {
    clearAuthCookies(res);
    clearOnboardingCookie(res);
    clearMfaChallengeCookie(res);
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'SESSION_REVOKED',
    targetType: 'session',
    targetId: session.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/sessions/revoke-all', requireAuth, async (req, res) => {
  const parseResult = sessionsRevokeAllSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const includeCurrent = parseResult.data.include_current !== false;
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const refreshHash = refreshToken ? hashToken(refreshToken) : null;
  const currentSession = refreshHash
    ? await prisma.session.findUnique({ where: { refreshTokenHash: refreshHash } })
    : null;

  if (includeCurrent) {
    await revokeAllSessions(userId);
    clearAuthCookies(res);
    clearOnboardingCookie(res);
    clearMfaChallengeCookie(res);
  } else if (currentSession) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSession.id } },
      data: { revokedAt: new Date() }
    });
  } else {
    await revokeAllSessions(userId);
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'SESSIONS_REVOKED_ALL',
    targetType: 'user',
    targetId: userId,
    metadata: { include_current: includeCurrent },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/mfa/backup-codes/regenerate', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const hasRecentMfa = await ensureRecentMfaIfEnabled(userId);
  if (!hasRecentMfa) {
    res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled) {
    res.status(400).json({ error: 'MFA_NOT_CONFIGURED', request_id: req.id });
    return;
  }

  const backupCodes = Array.from({ length: 8 }, () => generateRandomToken(8));
  const backupCodeHashes = backupCodes.map((codeValue) => ({
    userId,
    codeHash: hashBackupCode(codeValue)
  }));

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({ data: backupCodeHashes })
  ]);

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'BACKUP_CODES_REGENERATED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ backup_codes: backupCodes, request_id: req.id });
});

router.post('/security/alerts', requireAuth, async (req, res) => {
  const parseResult = securityAlertsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  if (parseResult.data.sms_enabled && !user.phoneVerifiedAt) {
    res.status(400).json({ error: 'PHONE_NOT_VERIFIED', request_id: req.id });
    return;
  }
  if (
    parseResult.data.sms_enabled &&
    !env.twilioMessagingServiceSid &&
    !env.twilioSmsFrom
  ) {
    res.status(400).json({ error: 'SMS_NOT_AVAILABLE', request_id: req.id });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      securityAlertEmailEnabled: parseResult.data.email_enabled,
      securityAlertSmsEnabled: parseResult.data.sms_enabled
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'SECURITY_ALERTS_UPDATED',
    targetType: 'user',
    targetId: userId,
    metadata: {
      email_enabled: parseResult.data.email_enabled,
      sms_enabled: parseResult.data.sms_enabled
    },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/recovery-email', requireAuth, recoveryEmailLimiter, async (req, res) => {
  const parseResult = recoveryEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  if (user.passwordHash) {
    if (!parseResult.data.password) {
      res.status(400).json({ error: 'PASSWORD_REQUIRED', request_id: req.id });
      return;
    }
    const valid = await verifyPassword(user.passwordHash, parseResult.data.password);
    if (!valid) {
      res.status(401).json({ error: 'INVALID_PASSWORD', request_id: req.id });
      return;
    }
  }

  const hasRecentMfa = await ensureRecentMfaIfEnabled(userId);
  if (!hasRecentMfa) {
    res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
    return;
  }

  const recoveryEmail = normalizeEmail(parseResult.data.email);
  const existingRecovery = await prisma.user.findFirst({
    where: {
      recoveryEmail,
      id: { not: userId }
    },
    select: { id: true }
  });
  if (existingRecovery) {
    res.status(409).json({ error: 'RECOVERY_EMAIL_TAKEN', request_id: req.id });
    return;
  }
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.recoveryEmailToken.deleteMany({ where: { userId } }),
    prisma.recoveryEmailToken.create({
      data: {
        userId,
        email: recoveryEmail,
        tokenHash,
        expiresAt
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { recoveryEmailPending: recoveryEmail }
    })
  ]);

  const verifyLink = `${env.appBaseUrl}/verify-recovery-email?token=${encodeURIComponent(rawToken)}`;
  let emailSent = true;
  try {
    await sendEmail({
      to: recoveryEmail,
      subject: 'Validation de votre email de recuperation',
      html: buildEmailHtml({
        title: 'Validation de votre email de recuperation',
        preview: 'Confirmez votre email de recuperation.',
        intro: 'Vous avez demande a ajouter un email de recuperation.',
        actionLabel: 'Confirmer mon email',
        actionUrl: verifyLink,
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      }),
      text: buildEmailText({
        title: 'Validation de votre email de recuperation',
        intro: 'Vous avez demande a ajouter un email de recuperation.',
        actionLabel: 'Confirmer mon email',
        actionUrl: verifyLink,
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      })
    });
  } catch {
    emailSent = false;
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'RECOVERY_EMAIL_REQUESTED',
    targetType: 'user',
    targetId: userId,
    metadata: { email_sent: emailSent },
    requestId: req.id
  });

  res.json({
    ok: true,
    email_sent: emailSent,
    request_id: req.id,
    ...(env.isTest ? { test_token: rawToken } : {})
  });
});

router.delete('/recovery-email', requireAuth, async (req, res) => {
  const parseResult = recoveryEmailRemoveSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  if (user.passwordHash) {
    if (!parseResult.data.password) {
      res.status(400).json({ error: 'PASSWORD_REQUIRED', request_id: req.id });
      return;
    }
    const valid = await verifyPassword(user.passwordHash, parseResult.data.password);
    if (!valid) {
      res.status(401).json({ error: 'INVALID_PASSWORD', request_id: req.id });
      return;
    }
  }

  const hasRecentMfa = await ensureRecentMfaIfEnabled(userId);
  if (!hasRecentMfa) {
    res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
    return;
  }

  await prisma.$transaction([
    prisma.recoveryEmailToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        recoveryEmail: null,
        recoveryEmailVerifiedAt: null,
        recoveryEmailPending: null
      }
    })
  ]);

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'RECOVERY_EMAIL_REMOVED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

// ============================================
// Password & Email Management
// ============================================

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'passwords_do_not_match',
  path: ['confirmPassword']
});

const changeEmailSchema = z.object({
  newEmail: z.string().email().max(320),
  password: z.string().optional()
});

router.post('/password', requireAuth, async (req, res) => {
  const parseResult = changePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parseResult.error.errors[0]?.message,
      request_id: req.id
    });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  if (!user.passwordHash) {
    res.status(400).json({
      error: 'NO_PASSWORD_SET',
      message: 'Vous devez d\'abord définir un mot de passe.',
      request_id: req.id
    });
    return;
  }

  const valid = await verifyPassword(user.passwordHash, parseResult.data.currentPassword);
  if (!valid) {
    res.status(401).json({
      error: 'INVALID_PASSWORD',
      message: 'Mot de passe actuel incorrect',
      request_id: req.id
    });
    return;
  }

  const newHash = await hashPassword(parseResult.data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash }
  });

  await revokeAllSessions(userId); // Revoke all other sessions for security
  // Note: ideally we might want to keep *current* session, but revokeAll revokes all.
  // The user might be logged out. Let's see if we should keep current session.
  // The accessToken is robust, but the refreshToken in DB will be revoked.
  // We should issue a new session or let them re-login. Re-login is safer.

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'PASSWORD_CHANGED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/email', requireAuth, async (req, res) => {
  const parseResult = changeEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  // If user has a password, verify it
  if (user.passwordHash) {
    if (!parseResult.data.password) {
      res.status(400).json({
        error: 'PASSWORD_REQUIRED',
        message: 'Mot de passe requis pour changer d\'email.',
        request_id: req.id
      });
      return;
    }
    const valid = await verifyPassword(user.passwordHash, parseResult.data.password);
    if (!valid) {
      res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Mot de passe incorrect',
        request_id: req.id
      });
      return;
    }
  }

  const newEmail = normalizeEmail(parseResult.data.newEmail);

  // Check if email already taken
  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    res.status(409).json({
      error: 'EMAIL_UNAVAILABLE',
      message: 'Cet email est déjà utilisé.',
      request_id: req.id
    });
    return;
  }

  // Generate verification link
  const token = signEmailChangeToken({
    sub: userId,
    newEmail: newEmail,
    type: 'email_change'
  }, 60); // 1 hour validity

  const verifyLink = `${env.appBaseUrl}/auth/verify-email-change?token=${token}`;

  await sendEmail({
    to: newEmail,
    subject: 'Vérification de votre nouvel email',
    html: buildEmailHtml(`
      <h1>Changement d'email</h1>
      <p>Vous avez demandé à changer votre email pour ${newEmail}.</p>
      <p>Cliquez ci-dessous pour confirmer ce changement :</p>
      <a href="${verifyLink}" class="button">Vérifier mon nouvel email</a>
      <p>Ce lien expire dans 1 heure.</p>
    `),
    text: buildEmailText(`Vérifiez votre nouvel email : ${verifyLink}`)
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'EMAIL_CHANGE_REQUESTED',
    targetType: 'user',
    targetId: userId,
    metadata: { new_email: newEmail },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

export { router as meRouter };
