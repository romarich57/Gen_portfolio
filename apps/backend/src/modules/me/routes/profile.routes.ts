import { Router } from 'express';
import {
  getProfileHandler,
  updateProfileHandler
} from '../handlers/profile.handlers';

const router = Router();

router.get('/', getProfileHandler);
router.patch('/', updateProfileHandler);

export { router as profileRoutes };
