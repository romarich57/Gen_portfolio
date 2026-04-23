import type { Request, Response } from 'express';
import {
  couponSchema,
  creditsAdjustSchema,
  planCreateSchema,
  planUpdateSchema,
  subscriptionChangeSchema
} from '../schemas/billing.schema';
import { getRouteParam, sendValidationError } from '../shared/http';
import {
  adjustUserCredits,
  changeUserSubscription,
  createPlan,
  createStripeCoupon,
  getUserCredits,
  listPlans,
  updatePlan
} from '../services/billing.service';

function actorContext(req: Request) {
  return {
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null
  };
}

export async function listPlansHandler(req: Request, res: Response) {
  const plans = await listPlans();
  res.json({ plans, request_id: req.id });
}

export async function createPlanHandler(req: Request, res: Response) {
  const parseResult = planCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const id = await createPlan(parseResult.data, actorContext(req), req.id);
  res.status(201).json({ id, request_id: req.id });
}

export async function updatePlanHandler(req: Request, res: Response) {
  const planId = getRouteParam(req.params.planId);
  if (!planId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = planUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }
  try {
    await updatePlan(planId, parseResult.data, actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}

export async function createCouponHandler(req: Request, res: Response) {
  const parseResult = couponSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const result = await createStripeCoupon(parseResult.data, actorContext(req), req.id);
    res.status(201).json({ ...result, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'VALIDATION_ERROR') {
      sendValidationError(res, req.id);
      return;
    }
    throw error;
  }
}

export async function changeSubscriptionHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = subscriptionChangeSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await changeUserSubscription(userId, parseResult.data, actorContext(req), req.id);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    if (error.message === 'PLAN_NOT_FOUND') {
      res.status(404).json({ error: 'PLAN_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error.message === 'PLAN_NOT_CONFIGURED' || error.message === 'CUSTOMER_NOT_FOUND') {
      res.status(400).json({ error: error.message, request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}

export async function getUserCreditsHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const summary = await getUserCredits(userId);
    res.json({ ...summary, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function adjustUserCreditsHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = creditsAdjustSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const balance = await adjustUserCredits(
      userId,
      parseResult.data.delta,
      parseResult.data.reason,
      actorContext(req),
      req.id
    );
    res.json({ balance, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'CREDITS_INSUFFICIENT') {
      res.status(400).json({ error: 'CREDITS_INSUFFICIENT', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}
