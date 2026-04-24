import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/rbac';
import { requireRecentMfa } from '../middleware/stepUp';
import { writeAuditLog } from '../services/audit';
import { refreshServiceStatus, getServiceStatusHistory } from '../services/serviceStatus';
import { resetMfaPolicyCache } from '../services/mfaPolicy';
import { logger } from '../middleware/logger';
import { getOtpRateLimits, resetOtpRateLimitsCache } from '../services/settings';
import {
  getAdminMfaFlags,
  setUserMfaOverride,
  updateAdminOtpRateLimits,
  upsertAdminFlag
} from '../modules/admin/services/platform-settings.service';

const router = Router();

router.use(requireAuth, requireRole('admin', 'super_admin'));

const mfaFlagsSchema = z
  .object({
    mfaRequiredGlobal: z.boolean().optional(),
    allowDisableMfa: z.boolean().optional()
  })
  .refine((data) => data.mfaRequiredGlobal !== undefined || data.allowDisableMfa !== undefined, {
    message: 'At least one flag must be provided'
  });

const otpRateLimitsSchema = z.object({
  phoneStart: z.object({
    windowMs: z.number().int().min(1_000).max(60 * 60 * 1000),
    limit: z.number().int().min(1).max(1000),
    targetLimit: z.number().int().min(1).max(1000)
  }),
  phoneCheck: z.object({
    windowMs: z.number().int().min(1_000).max(60 * 60 * 1000),
    limit: z.number().int().min(1).max(1000),
    targetLimit: z.number().int().min(1).max(1000),
    maxAttempts: z.number().int().min(1).max(20)
  })
});

const mfaOverrideSchema = z.object({
  required: z.boolean().nullable()
});

router.get('/security/mfa-flags', async (req, res) => {
  const flags = await getAdminMfaFlags();

  res.json({
    mfaRequiredGlobal: flags.mfaRequiredGlobal,
    allowDisableMfa: flags.allowDisableMfa,
    request_id: req.id
  });
});

router.put('/security/mfa-flags', requireRecentMfa, async (req, res) => {
  const parseResult = mfaFlagsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { mfaRequiredGlobal, allowDisableMfa } = parseResult.data;
  const updates: Record<string, boolean> = {};

  if (mfaRequiredGlobal !== undefined) {
    await upsertAdminFlag('mfa_required_global', mfaRequiredGlobal);
    updates.mfa_required_global = mfaRequiredGlobal;
  }

  if (allowDisableMfa !== undefined) {
    await upsertAdminFlag('allow_disable_mfa', allowDisableMfa);
    updates.allow_disable_mfa = allowDisableMfa;
  }

  resetMfaPolicyCache();

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_MFA_FLAGS_UPDATED',
    targetType: 'feature_flags',
    targetId: null,
    metadata: updates,
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.get('/security/otp-rate-limits', async (req, res) => {
  const limits = await getOtpRateLimits();
  res.json({ limits, request_id: req.id });
});

router.put('/security/otp-rate-limits', requireRecentMfa, async (req, res) => {
  const parseResult = otpRateLimitsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  await updateAdminOtpRateLimits(parseResult.data);
  resetOtpRateLimitsCache();

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_OTP_RATE_LIMITS_UPDATED',
    targetType: 'app_settings',
    targetId: 'otp_rate_limits',
    metadata: parseResult.data,
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.patch('/users/:id/mfa-override', requireRecentMfa, async (req, res) => {
  const parseResult = mfaOverrideSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = typeof req.params.id === 'string' ? req.params.id : null;
  if (!userId) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  try {
    await setUserMfaOverride(userId, parseResult.data.required);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_USER_MFA_OVERRIDE',
    targetType: 'user',
    targetId: userId,
    metadata: { required: parseResult.data.required },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.get('/status/services', async (req, res) => {
  const snapshot = await refreshServiceStatus({ notify: false });
  const ok = snapshot.ok;

  if (!ok) {
    logger.warn(
      {
        request_id: req.id,
        smtp_ok: snapshot.services.smtp.ok,
        s3_ok: snapshot.services.s3.ok,
        redis_ok: snapshot.services.redis.ok,
        queue_ok: snapshot.services.queue.ok,
        queue_queued_overdue: snapshot.services.queue.queuedOverdue,
        queue_running_stale: snapshot.services.queue.runningStale
      },
      'Service status check failed'
    );
  }

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_SERVICE_STATUS_CHECK',
    targetType: 'service_status',
    targetId: null,
    metadata: {
      smtp_ok: snapshot.services.smtp.ok,
      s3_ok: snapshot.services.s3.ok,
      redis_ok: snapshot.services.redis.ok,
      queue_ok: snapshot.services.queue.ok,
      queue_queued_overdue: snapshot.services.queue.queuedOverdue,
      queue_running_stale: snapshot.services.queue.runningStale
    },
    requestId: req.id
  });

  res.json({
    ok: snapshot.ok,
    timestamp: snapshot.checkedAt.toISOString(),
    services: {
      smtp: {
        ok: snapshot.services.smtp.ok,
        latency_ms: snapshot.services.smtp.latencyMs,
        error: snapshot.services.smtp.error ?? null
      },
      s3: {
        ok: snapshot.services.s3.ok,
        latency_ms: snapshot.services.s3.latencyMs,
        error: snapshot.services.s3.error ?? null
      },
      redis: {
        ok: snapshot.services.redis.ok,
        latency_ms: snapshot.services.redis.latencyMs,
        error: snapshot.services.redis.error ?? null
      },
      queue: {
        ok: snapshot.services.queue.ok,
        latency_ms: snapshot.services.queue.latencyMs,
        error: snapshot.services.queue.error ?? null,
        queued_overdue: snapshot.services.queue.queuedOverdue,
        running_stale: snapshot.services.queue.runningStale
      }
    },
    request_id: req.id
  });
});

router.get('/status/services/history', async (req, res) => {
  const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : null;
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam ?? 0, 200)) : undefined;
  await refreshServiceStatus({ notify: false });
  const history = getServiceStatusHistory(limit);

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_SERVICE_STATUS_HISTORY',
    targetType: 'service_status',
    targetId: null,
    metadata: { limit: limit ?? null },
    requestId: req.id
  });

  res.json({
    ok: true,
    count: history.length,
    history: history.map((entry) => ({
      ok: entry.ok,
      checked_at: entry.checkedAt.toISOString(),
      services: {
        smtp: {
          ok: entry.services.smtp.ok,
          latency_ms: entry.services.smtp.latencyMs,
          error: entry.services.smtp.error ?? null
        },
        s3: {
          ok: entry.services.s3.ok,
          latency_ms: entry.services.s3.latencyMs,
          error: entry.services.s3.error ?? null
        },
        redis: {
          ok: entry.services.redis.ok,
          latency_ms: entry.services.redis.latencyMs,
          error: entry.services.redis.error ?? null
        },
        queue: {
          ok: entry.services.queue.ok,
          latency_ms: entry.services.queue.latencyMs,
          error: entry.services.queue.error ?? null,
          queued_overdue: entry.services.queue.queuedOverdue,
          running_stale: entry.services.queue.runningStale
        }
      }
    })),
    request_id: req.id
  });
});

export { router as adminRouter };
