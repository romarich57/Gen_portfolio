import type { Request, Response } from 'express';
import { writeAuditLog } from '../../../services/audit';
import { consentSchema } from '../schemas/consents.schema';
import { requireUserId } from '../shared/http';
import { recordConsentsForUser } from '../services/consents.service';

export async function recordConsentsHandler(req: Request, res: Response) {
  const parseResult = consentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  await recordConsentsForUser({
    userId,
    ...parseResult.data,
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'CONSENTS_UPDATED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
}
