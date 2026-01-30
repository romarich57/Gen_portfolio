import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ipKeyGenerator } from 'express-rate-limit';
import { requireAuth, requirePermission } from '../middleware/rbac';
import { buildRateLimiter } from '../middleware/rateLimit';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { writeAuditLog } from '../services/audit';
import { createCheckoutSession, createPortalSession, getBillingStatus, getPlans } from '../services/billing';
import { countRecentFailures, recordAuthAttempt } from '../services/authAttempts';
import { verifyCaptchaToken } from '../services/captcha';
import { AuthAttemptType } from '@prisma/client';

const router = Router();

const userKey = (req: { user?: { id: string } }) => req.user?.id ?? 'unknown';
const ipOnly = (req: Request) => ipKeyGenerator(req.ip || '0.0.0.0');

const checkoutUserLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 3,
  keyGenerator: userKey
});

const checkoutIpLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: ipOnly
});

const portalLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: userKey
});

const checkoutSchema = z.object({
  planCode: z.enum(['FREE', 'PREMIUM', 'VIP']),
  captchaToken: z.string().optional()
});

async function enforceCheckoutCaptcha(params: { email: string; ip?: string | null; captchaToken?: string }) {
  const failures = await countRecentFailures({
    type: AuthAttemptType.billing_checkout,
    email: params.email,
    ip: params.ip ?? null,
    windowMinutes: 10
  });

  if (failures < 3) return { required: false, valid: true };
  const valid = await verifyCaptchaToken(params.captchaToken, params.ip ?? undefined);
  return { required: true, valid };
}

router.get('/plans', requireAuth, requirePermission('billing:read'), async (req, res) => {
  const plans = await getPlans();
  res.json({
    plans,
    request_id: req.id
  });
});

router.post(
  '/checkout-session',
  requireAuth,
  requirePermission('billing:checkout'),
  checkoutIpLimiter,
  checkoutUserLimiter,
  async (req, res) => {
    const parseResult = checkoutSchema.safeParse(req.body);
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

    const captchaCheck = await enforceCheckoutCaptcha({
      email: user.email,
      ip: req.ip ?? null,
      ...(parseResult.data.captchaToken ? { captchaToken: parseResult.data.captchaToken } : {})
    });

    if (captchaCheck.required && !captchaCheck.valid) {
      await recordAuthAttempt({
        type: AuthAttemptType.billing_checkout,
        email: user.email,
        ip: req.ip ?? null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        success: false,
        userId
      });
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }

    try {
      const session = await createCheckoutSession({
        userId,
        userEmail: user.email,
        planCode: parseResult.data.planCode
      });

      await recordAuthAttempt({
        type: AuthAttemptType.billing_checkout,
        email: user.email,
        ip: req.ip ?? null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        success: true,
        userId
      });

      await writeAuditLog({
        actorUserId: userId,
        actorIp: req.ip ?? null,
        action: 'BILLING_CHECKOUT_CREATED',
        targetType: 'plan',
        targetId: parseResult.data.planCode,
        metadata: { env: env.nodeEnv },
        requestId: req.id
      });

      res.json({ checkout_url: session.url, request_id: req.id });
    } catch (error) {
      await recordAuthAttempt({
        type: AuthAttemptType.billing_checkout,
        email: user.email,
        ip: req.ip ?? null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        success: false,
        userId
      });
      res.status(400).json({ error: 'PLAN_INVALID', request_id: req.id });
    }
  }
);

const handlePortal = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const session = await createPortalSession({ userId });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'BILLING_PORTAL_OPENED',
      targetType: 'user',
      targetId: userId,
      metadata: {},
      requestId: req.id
    });
    res.json({ portal_url: session.url, request_id: req.id });
  } catch (error) {
    res.status(400).json({ error: 'BILLING_PORTAL_UNAVAILABLE', request_id: req.id });
  }
};

router.post('/portal', requireAuth, requirePermission('billing:portal'), portalLimiter, handlePortal);
router.post('/portal-session', requireAuth, requirePermission('billing:portal'), portalLimiter, handlePortal);

router.get('/status', requireAuth, requirePermission('billing:read'), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const status = await getBillingStatus(userId);
  res.json({ ...status, request_id: req.id });
});

export { router as billingRouter };
