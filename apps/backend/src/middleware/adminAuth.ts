import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from './rbac';

type AdminRole = 'admin' | 'super_admin';

function hasAdminRole(roles: string[] | undefined): boolean {
  return Boolean(roles?.some((role) => role === 'admin' || role === 'super_admin'));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireAuth(req, res, () => {
    const roles = req.user?.roles ?? [];
    if (!hasAdminRole(roles)) {
      res.status(403).json({ error: 'FORBIDDEN', request_id: req.id });
      return;
    }
    next();
  });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireAuth(req, res, () => {
    const roles = req.user?.roles ?? [];
    if (!roles.includes('super_admin')) {
      res.status(403).json({ error: 'FORBIDDEN', request_id: req.id });
      return;
    }
    next();
  });
}

export function isAdminRole(role: string): role is AdminRole {
  return role === 'admin' || role === 'super_admin';
}
