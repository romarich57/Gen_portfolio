import { Router } from 'express';
import { adminApiLimiter } from '../../middleware/rateLimit';
import { adminSettingsRoutes } from './routes/settings.routes';
import { adminUsersRoutes } from './routes/users.routes';
import { adminSecurityRoutes } from './routes/security.routes';
import { adminBillingRoutes } from './routes/billing.routes';
import { adminAuditRoutes } from './routes/audit.routes';
import { adminExportsRoutes } from './routes/exports.routes';

const router = Router();

router.use(adminApiLimiter);
router.use(adminSettingsRoutes);
router.use(adminUsersRoutes);
router.use(adminSecurityRoutes);
router.use(adminBillingRoutes);
router.use(adminAuditRoutes);
router.use(adminExportsRoutes);

export { router as adminModuleRouter };
