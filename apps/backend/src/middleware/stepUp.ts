import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

async function requireRecentMfa(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, enabledAt: { not: null } },
    orderBy: { lastUsedAt: 'desc' }
  });

  if (!factor || !factor.lastUsedAt) {
    res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
    return;
  }

  const maxAgeMs = env.reauthMaxHours * 60 * 60 * 1000;
  if (Date.now() - factor.lastUsedAt.getTime() > maxAgeMs) {
    res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
    return;
  }

  next();
}

export { requireRecentMfa };
