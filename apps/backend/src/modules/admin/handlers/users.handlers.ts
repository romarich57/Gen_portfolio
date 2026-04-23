import type { Request, Response } from 'express';
import { revealSchema, roleSchema, statusSchema, usersQuerySchema } from '../schemas/users.schema';
import { getRouteParam, sendValidationError } from '../shared/http';
import {
  getUserDetails,
  getUsersOverview,
  listUsers,
  revealUserFields,
  updateUserRole,
  updateUserStatus
} from '../services/users.service';

function actorContext(req: Request) {
  return {
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    actorRoles: req.user?.roles
  };
}

export async function getUsersOverviewHandler(req: Request, res: Response) {
  const overview = await getUsersOverview();
  res.json({ ...overview, request_id: req.id });
}

export async function listUsersHandler(req: Request, res: Response) {
  const parseResult = usersQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const result = await listUsers(parseResult.data);
  res.json({ ...result, request_id: req.id });
}

export async function getUserDetailsHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const details = await getUserDetails(userId);
    res.json({ ...details, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function revealUserFieldsHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = revealSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }
  if (parseResult.data.confirm !== 'AFFICHER') {
    res.status(403).json({ error: 'CONFIRM_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const data = await revealUserFields(userId, parseResult.data.fields, actorContext(req), req.id);
    res.json({ ...data, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function updateUserRoleHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = roleSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await updateUserRole(userId, parseResult.data.role, actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'FORBIDDEN', request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}

export async function updateUserStatusHandler(req: Request, res: Response) {
  const userId = getRouteParam(req.params.id);
  if (!userId) {
    sendValidationError(res, req.id);
    return;
  }

  const parseResult = statusSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await updateUserStatus(userId, parseResult.data.status_action, actorContext(req), req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}
