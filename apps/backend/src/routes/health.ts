import { Router } from 'express';
import { env } from '../config/env';
import { ensureServiceStatusFresh } from '../services/serviceStatus';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const status = await ensureServiceStatusFresh(env.serviceStatusCacheTtlSeconds * 1000);
    const includeDetails = !env.isProduction;
    res.json({
      status: status.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      ...(includeDetails
        ? {
            services: {
              smtp: { ok: status.services.smtp.ok },
              s3: { ok: status.services.s3.ok },
              redis: { ok: status.services.redis.ok }
            }
          }
        : {}),
      checked_at: status.checkedAt.toISOString(),
      request_id: req.id
    });
  } catch {
    const includeDetails = !env.isProduction;
    res.status(200).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      ...(includeDetails
        ? {
            services: {
              smtp: { ok: false },
              s3: { ok: false },
              redis: { ok: false }
            }
          }
        : {}),
      checked_at: null,
      request_id: req.id
    });
  }
});

export const healthRouter = router;
