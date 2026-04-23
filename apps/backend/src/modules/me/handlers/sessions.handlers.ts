import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '../../../config/auth';
import { writeAuditLog } from '../../../services/audit';
import {
  clearAuthCookies,
  clearMfaChallengeCookie,
  clearOnboardingCookie
} from '../../../utils/cookies';
import {
  sessionRevokeSchema,
  sessionsRevokeAllSchema
} from '../schemas/sessions.schema';
import { requireUserId } from '../shared/http';
import {
  listActiveSessionsForUser,
  listSessionHistoryForUser,
  revokeAllSessionsForUser,
  revokeSingleSessionForUser
} from '../services/sessions.service';

function clearSessionCookies(res: Response) {
  clearAuthCookies(res);
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);
}

export async function listSessionsHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const sessions = await listActiveSessionsForUser({
    userId,
    refreshToken: req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined
  });

  res.json({ sessions, request_id: req.id });
}

export async function listSessionHistoryHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const sessions = await listSessionHistoryForUser({
    userId,
    refreshToken: req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined
  });

  res.json({ sessions, request_id: req.id });
}

export async function revokeSessionHandler(req: Request, res: Response) {
  const parseResult = sessionRevokeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await revokeSingleSessionForUser({
      userId,
      sessionId: parseResult.data.session_id,
      refreshToken: req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined
    });

    if (result.clearCookies) {
      clearSessionCookies(res);
    }

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'SESSION_REVOKED',
      targetType: 'session',
      targetId: result.sessionId,
      metadata: {},
      requestId: req.id
    });

    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function revokeAllSessionsHandler(req: Request, res: Response) {
  const parseResult = sessionsRevokeAllSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  const includeCurrent = parseResult.data.include_current !== false;
  const result = await revokeAllSessionsForUser({
    userId,
    includeCurrent,
    refreshToken: req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined
  });

  if (result.clearCookies) {
    clearSessionCookies(res);
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
}
