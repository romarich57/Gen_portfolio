import { Router } from 'express';
import { buildRateLimiter } from '../middleware/rateLimit';

const router = Router();

const limitedRoute = buildRateLimiter({ windowMs: 60 * 1000, limit: 2 });

router.post('/state-change', (req, res) => {
  res.json({ ok: true, request_id: req.id });
});

router.post('/limited', limitedRoute, (req, res) => {
  res.json({ ok: true, request_id: req.id });
});

export const testRouter = router;
