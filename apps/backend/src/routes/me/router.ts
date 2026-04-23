import { Router } from 'express';
import { meModuleRouter } from '../../modules/me/router';

const router = Router();

router.use(meModuleRouter);

export { router as meRouter };
