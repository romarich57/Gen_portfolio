import type { Request, Response } from 'express';
import { logger } from '../../../middleware/logger';
import { syncSchema } from '../schemas/billing.schema';
import { sendValidationError } from '../shared/http';
import {
  getUserBillingStatus,
  listPlans,
  mapCheckoutError,
  syncUserCheckoutSession
} from '../services/plans-status.service';

export async function listPlansHandler(req: Request, res: Response) {
  const plans = await listPlans();
  res.json({ plans, request_id: req.id });
}

export async function getBillingStatusHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const status = await getUserBillingStatus(userId);
  res.json({ ...status, request_id: req.id });
}

export async function syncCheckoutSessionHandler(req: Request, res: Response) {
  const parseResult = syncSchema.safeParse(req.body);
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
    const result = await syncUserCheckoutSession({
      sessionId: parseResult.data.sessionId,
      userId,
      actorIp: req.ip ?? null,
      requestId: req.id
    });
    res.json({ ...result, request_id: req.id });
  } catch (error) {
    const mapped = mapCheckoutError(error);
    logger.warn(
      {
        error: mapped.errorMessage,
        userId,
        requestId: req.id,
        ...(mapped.debug ? { debug: mapped.debug } : {})
      },
      'Billing sync failed'
    );
    res.status(400).json({ error: mapped.errorCode, request_id: req.id, ...(mapped.debug ? { debug: mapped.debug } : {}) });
  }
}
