import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { ACCESS_COOKIE_NAME } from '../config/auth';
import { verifyAccessToken } from '../utils/jwt';

type OwnerIdResolver = (req: Request) => string | null;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  user: ['billing:read', 'billing:checkout', 'billing:portal', 'resume:write', 'ai:resume:use'],
  premium: ['billing:read', 'billing:checkout', 'billing:portal', 'resume:write', 'ai:resume:use'],
  vip: ['billing:read', 'billing:checkout', 'billing:portal', 'resume:write', 'ai:resume:use'],
  admin: ['billing:read', 'billing:checkout', 'billing:portal', 'resume:write', 'ai:resume:use', 'admin:all'],
  super_admin: ['billing:read', 'billing:checkout', 'billing:portal', 'resume:write', 'ai:resume:use', 'admin:all']
};

function resolvePermissions(roles: string[] = []): string[] {
  const permissions = new Set<string>();
  roles.forEach((role) => {
    const rolePermissions = ROLE_PERMISSIONS[role] ?? [];
    rolePermissions.forEach((permission) => permissions.add(permission));
  });
  return Array.from(permissions);
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        request_id: req.id
      });
      return;
    }

    let payload: ReturnType<typeof verifyAccessToken>;
    try {
      payload = verifyAccessToken(token);
    } catch {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        request_id: req.id
      });
      return;
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 'active' || user.deletedAt) {
        res.status(403).json({
          error: 'FORBIDDEN',
          request_id: req.id
        });
        return;
      }

      req.user = {
        id: user.id,
        roles: user.roles as unknown as string[],
        permissions: resolvePermissions(user.roles as unknown as string[])
      };
      next();
    } catch {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        request_id: req.id
      });
      return;
    }

    return;
  }
  next();
}

function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        request_id: req.id
      });
      return;
    }
    const userRoles = req.user.roles || [];
    const allowed = roles.some((role) => userRoles.includes(role));
    if (!allowed) {
      res.status(403).json({
        error: 'FORBIDDEN',
        request_id: req.id
      });
      return;
    }
    next();
  };
}

function requirePermission(...permissions: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        request_id: req.id
      });
      return;
    }
    const userPermissions = req.user.permissions || [];
    const allowed = permissions.every((permission) => userPermissions.includes(permission));
    if (!allowed) {
      res.status(403).json({
        error: 'FORBIDDEN',
        request_id: req.id
      });
      return;
    }
    next();
  };
}

function requireOwnership(getOwnerId: OwnerIdResolver): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        request_id: req.id
      });
      return;
    }
    const ownerId = getOwnerId(req);
    if (!ownerId || ownerId !== req.user.id) {
      res.status(403).json({
        error: 'FORBIDDEN',
        request_id: req.id
      });
      return;
    }
    next();
  };
}

export { requireAuth, requireRole, requirePermission, requireOwnership, resolvePermissions };
