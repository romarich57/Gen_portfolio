import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { resolvePermissions } from './rbac';

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function attachTestUser(req: Request, _res: Response, next: NextFunction): void {
  if (!env.isTest) return next();
  const userId = normalizeHeader(req.headers['x-test-user-id']);
  if (!userId) return next();

  const rolesHeader = normalizeHeader(req.headers['x-test-user-roles']);
  const permissionsHeader = normalizeHeader(req.headers['x-test-user-permissions']);

  const roles =
    typeof rolesHeader === 'string' && rolesHeader.length > 0
      ? rolesHeader.split(',').map((role) => role.trim()).filter(Boolean)
      : [];

  const permissions =
    typeof permissionsHeader === 'string' && permissionsHeader.length > 0
      ? permissionsHeader.split(',').map((permission) => permission.trim()).filter(Boolean)
      : resolvePermissions(roles);

  req.user = {
    id: userId,
    roles,
    permissions
  };

  return next();
}

export { attachTestUser };
