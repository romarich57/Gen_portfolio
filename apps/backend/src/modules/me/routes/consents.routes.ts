import { Router } from 'express';
import { recordConsentsHandler } from '../handlers/consents.handlers';

const router = Router();

router.post('/consents', recordConsentsHandler);

export { router as consentsRoutes };
