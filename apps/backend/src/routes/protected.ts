import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac';

const router = Router();

router.post('/rbac-test', requireAuth, requireRole('admin', 'super_admin'), (req, res) => {
  res.json({
    ok: true,
    request_id: req.id
  });
});

export const protectedRouter = router;
