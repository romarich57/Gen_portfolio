import type { Request, Response } from 'express';
import { exportsQuerySchema } from '../schemas/exports.schema';
import { getRouteParam, sendValidationError } from '../shared/http';
import {
  listExports,
  purgeUserDeletion,
  requestUserDeletion,
  requestUserExport
} from '../services/exports.service';

function actorContext(req: Request) {
  return {
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null
  };
}

export async function requestUserExportHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const exportId = await requestUserExport(userId, actorContext(req), req.id);
    res.json({ ok: true, export_id: exportId, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function requestUserDeletionHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await requestUserDeletion(userId, actorContext(req), req.id);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function purgeUserDeletionHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await purgeUserDeletion(userId, actorContext(req), req.id);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'PURGE_NOT_READY') {
      res.status(409).json({ error: 'PURGE_NOT_READY', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function listExportsHandler(req: Request, res: Response) {
  const parseResult = exportsQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const result = await listExports(parseResult.data);
  res.json({ ...result, request_id: req.id });
}
