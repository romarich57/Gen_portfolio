import type { Request, Response } from 'express';
import { passwordResetSchema, sessionsRevokeSchema } from '../schemas/security.schema';
import { getRouteParam, sendValidationError } from '../shared/http';
import {
  forceEmailVerification,
  revokeEmailVerification,
  revokeUserSessions,
  triggerAdminPasswordReset
} from '../services/security.service';

function actorContext(req: Request) {
  return {
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null
  };
}

export async function triggerAdminPasswordResetHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = passwordResetSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await triggerAdminPasswordReset(userId, parseResult.data.mode, actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}

export async function forceEmailVerificationHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await forceEmailVerification(userId, actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
  res.json({ ok: true, request_id: req.id });
}

export async function revokeEmailVerificationHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await revokeEmailVerification(userId, actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
  res.json({ ok: true, request_id: req.id });
}

export async function revokeUserSessionsHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = sessionsRevokeSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await revokeUserSessions(userId, parseResult.data.mode ?? 'all', actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}
