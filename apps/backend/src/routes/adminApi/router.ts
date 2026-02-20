import { Router } from 'express';
import { adminUsersRouter } from './users.route';
import { adminSecurityRouter } from './security.route';
import { adminBillingRouter } from './billing.route';
import { adminAuditRouter } from './audit.route';
import { adminExportsRouter } from './exports.route';
import { adminSettingsRouter } from './settings.route';
import { adminApiLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(adminApiLimiter);
router.use(adminSettingsRouter);
router.use(adminUsersRouter);
router.use(adminSecurityRouter);
router.use(adminBillingRouter);
router.use(adminAuditRouter);
router.use(adminExportsRouter);

export { router as adminApiRouter };
