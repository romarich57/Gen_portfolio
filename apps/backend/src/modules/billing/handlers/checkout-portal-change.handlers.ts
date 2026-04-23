import type { Request, Response } from 'express';
import { logger } from '../../../middleware/logger';
import { checkoutSchema } from '../schemas/billing.schema';
import { sendValidationError } from '../shared/http';
import {
  changeUserPlan,
  createUserCheckoutSession,
  createUserPortalSession,
  mapBillingActionError
} from '../services/checkout-portal-change.service';

function requestMeta(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    requestId: req.id
  };
}

export async function createCheckoutSessionHandler(req: Request, res: Response) {
  const parseResult = checkoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const checkoutUrl = await createUserCheckoutSession({
      userId,
      planCode: parseResult.data.planCode,
      captchaToken: parseResult.data.captchaToken,
      meta: requestMeta(req)
    });
    res.json({ checkout_url: checkoutUrl, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }

    const mapped = mapBillingActionError(error);
    logger.warn(
      {
        error: mapped.errorMessage,
        userId,
        requestId: req.id,
        ...(mapped.debug ? { debug: mapped.debug } : {})
      },
      'Billing checkout failed'
    );
    res.status(400).json({ error: mapped.errorCode, request_id: req.id, ...(mapped.debug ? { debug: mapped.debug } : {}) });
  }
}

export async function changePlanHandler(req: Request, res: Response) {
  const parseResult = checkoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const result = await changeUserPlan({
      userId,
      planCode: parseResult.data.planCode,
      meta: requestMeta(req)
    });
    res.json({ ...result, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }

    const mapped = mapBillingActionError(error);
    logger.warn(
      {
        error: mapped.errorMessage,
        userId,
        requestId: req.id,
        ...(mapped.debug ? { debug: mapped.debug } : {})
      },
      'Billing plan change failed'
    );
    res.status(400).json({ error: mapped.errorCode, request_id: req.id, ...(mapped.debug ? { debug: mapped.debug } : {}) });
  }
}

export async function createPortalSessionHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const portalUrl = await createUserPortalSession({
      userId,
      actorIp: req.ip ?? null,
      requestId: req.id
    });
    res.json({ portal_url: portalUrl, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    res.status(400).json({ error: 'BILLING_PORTAL_UNAVAILABLE', request_id: req.id });
  }
}
