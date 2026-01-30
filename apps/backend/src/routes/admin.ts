import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole } from '../middleware/rbac';
import { writeAuditLog } from '../services/audit';
import { refreshServiceStatus, getServiceStatusHistory } from '../services/serviceStatus';
import { resetMfaPolicyCache } from '../services/mfaPolicy';
import { logger } from '../middleware/logger';
import { getOtpRateLimits, resetOtpRateLimitsCache } from '../services/settings';

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
    limit: z.number().int().min(1).max(1000)
  }),
  phoneCheck: z.object({
    windowMs: z.number().int().min(1_000).max(60 * 60 * 1000),
    limit: z.number().int().min(1).max(1000),
    maxAttempts: z.number().int().min(1).max(20)
  })
});

const mfaOverrideSchema = z.object({
  required: z.boolean().nullable()
});

async function upsertFlag(key: string, value: boolean) {
  return prisma.featureFlag.upsert({
    where: { key },
    update: { valueBoolean: value },
    create: { key, valueBoolean: value }
  });
}

router.get('/security/mfa-flags', async (req, res) => {
  const [globalFlag, allowDisableFlag] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key: 'mfa_required_global' } }),
    prisma.featureFlag.findUnique({ where: { key: 'allow_disable_mfa' } })
  ]);

  res.json({
    mfaRequiredGlobal: globalFlag?.valueBoolean ?? false,
    allowDisableMfa: allowDisableFlag?.valueBoolean ?? true,
    request_id: req.id
  });
});

router.put('/security/mfa-flags', async (req, res) => {
  const parseResult = mfaFlagsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { mfaRequiredGlobal, allowDisableMfa } = parseResult.data;
  const updates: Record<string, boolean> = {};

  if (mfaRequiredGlobal !== undefined) {
    await upsertFlag('mfa_required_global', mfaRequiredGlobal);
    updates.mfa_required_global = mfaRequiredGlobal;
  }

  if (allowDisableMfa !== undefined) {
    await upsertFlag('allow_disable_mfa', allowDisableMfa);
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

router.put('/security/otp-rate-limits', async (req, res) => {
  const parseResult = otpRateLimitsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  await prisma.appSetting.upsert({
    where: { key: 'otp_rate_limits' },
    update: { valueJson: parseResult.data },
    create: { key: 'otp_rate_limits', valueJson: parseResult.data }
  });
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

router.patch('/users/:id/mfa-override', async (req, res) => {
  const parseResult = mfaOverrideSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaRequiredOverride: parseResult.data.required }
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_USER_MFA_OVERRIDE',
    targetType: 'user',
    targetId: user.id,
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
        redis_ok: snapshot.services.redis.ok
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
      redis_ok: snapshot.services.redis.ok
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
        }
      }
    })),
    request_id: req.id
  });
});

export { router as adminRouter };
