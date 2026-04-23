import type { Request, Response } from 'express';
import { writeAuditLog } from '../../../services/audit';
import { profileSchema } from '../schemas/profile.schema';
import { requireUserId, sendValidationError } from '../shared/http';
import { getProfileForUser, updateProfileForUser } from '../services/profile.service';

export async function getProfileHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const profile = await getProfileForUser(userId);
    res.json({ profile, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function updateProfileHandler(req: Request, res: Response) {
  const parseResult = profileSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id, parseResult.error);
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    await updateProfileForUser(userId, parseResult.data);
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_UNAVAILABLE') {
      res.status(409).json({ error: 'USERNAME_UNAVAILABLE', request_id: req.id });
      return;
    }
    throw error;
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
}
