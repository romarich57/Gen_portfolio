import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { ACCESS_COOKIE_NAME } from '../config/auth';
import { verifyAccessToken } from '../utils/jwt';
import { resolvePermissions } from './rbac';
import { writeAuditLog } from '../services/audit';
import { getMfaPolicy, isMfaRequired } from '../services/mfaPolicy';

const SKIP_PREFIXES = ['/auth', '/health', '/webhooks', '/_test', '/api/admin'];

type AllowedRule = { method: string; pattern: RegExp };

const ALLOWED_RULES: AllowedRule[] = [
  { method: 'GET', pattern: /^\/me$/ },
  { method: 'GET', pattern: /^\/me\/onboarding$/ },
  { method: 'PATCH', pattern: /^\/me\/onboarding$/ },
  { method: 'GET', pattern: /^\/billing\/status$/ }
];

function isAllowedRequest(req: Request): boolean {
  return ALLOWED_RULES.some((rule) => rule.method === req.method && rule.pattern.test(req.path));
}

const MFA_ALLOWED_RULES: AllowedRule[] = [
  { method: 'GET', pattern: /^\/me$/ },
  { method: 'GET', pattern: /^\/me\/onboarding$/ },
  { method: 'PATCH', pattern: /^\/me\/onboarding$/ }
];

function isMfaAllowedRequest(req: Request): boolean {
  return MFA_ALLOWED_RULES.some((rule) => rule.method === req.method && rule.pattern.test(req.path));
}

async function onboardingGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }

  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    next();
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    next();
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    next();
    return;
  }

  req.user = {
    id: user.id,
    roles: user.roles as unknown as string[],
    permissions: resolvePermissions(user.roles as unknown as string[])
  };

  if (user.deletedAt) {
    res.status(403).json({ error: 'ACCOUNT_DELETED', request_id: req.id });
    return;
  }

  if (!user.onboardingCompletedAt && !isAllowedRequest(req)) {
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: req.ip ?? null,
      action: 'ONBOARDING_BLOCKED',
      targetType: 'user',
      targetId: user.id,
      metadata: { path: req.path, method: req.method },
      requestId: req.id
    });
    res.status(403).json({ error: 'ONBOARDING_REQUIRED', request_id: req.id });
    return;
  }

  const policy = await getMfaPolicy();
  if (isMfaRequired(user, policy) && !user.mfaEnabled && !isMfaAllowedRequest(req)) {
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: req.ip ?? null,
      action: 'MFA_ENFORCED_BLOCK',
      targetType: 'user',
      targetId: user.id,
      metadata: { path: req.path, method: req.method },
      requestId: req.id
    });
    res.status(403).json({ error: 'MFA_SETUP_REQUIRED', request_id: req.id });
    return;
  }

  next();
}

export { onboardingGate };
