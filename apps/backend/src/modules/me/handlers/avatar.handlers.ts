import type { Request, Response } from 'express';
import { writeAuditLog } from '../../../services/audit';
import { avatarConfirmSchema, avatarUploadSchema } from '../schemas/avatar.schema';
import { requireUserId } from '../shared/http';
import {
  confirmAvatarUploadForUser,
  issueAvatarUploadForUser
} from '../services/avatar.service';

export async function issueAvatarUploadHandler(req: Request, res: Response) {
  const parseResult = avatarUploadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { file, uploadUrl } = await issueAvatarUploadForUser({
      userId,
      ...parseResult.data
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
  } catch {
    res.status(400).json({ error: 'AVATAR_INVALID', request_id: req.id });
  }
}

export async function confirmAvatarUploadHandler(req: Request, res: Response) {
  const parseResult = avatarConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const file = await confirmAvatarUploadForUser({
      userId,
      ...parseResult.data
    });

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
  } catch {
    res.status(400).json({ error: 'AVATAR_INVALID', request_id: req.id });
  }
}
