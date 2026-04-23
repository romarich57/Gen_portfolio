import type { Request, Response } from 'express';
import { getAdminMe } from '../services/settings.service';

export async function getAdminMeHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  try {
    const me = await getAdminMe(userId);
    res.json({ ...me, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}
