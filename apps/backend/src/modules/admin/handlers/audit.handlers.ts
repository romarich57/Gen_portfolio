import type { Request, Response } from 'express';
import { auditQuerySchema } from '../schemas/audit.schema';
import { sendValidationError } from '../shared/http';
import { listAuditLogs } from '../services/audit.service';

export async function listAuditLogsHandler(req: Request, res: Response) {
  const parseResult = auditQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const result = await listAuditLogs(parseResult.data);
  res.json({ ...result, request_id: req.id });
}
