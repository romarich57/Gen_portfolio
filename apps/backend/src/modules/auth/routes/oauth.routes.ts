import { Router } from 'express';
import {
  oauthCallbackHandler,
  oauthDebugHandler,
  startOAuthHandler,
  unlinkOAuthHandler
} from '../handlers/oauth.handlers';

const router = Router();

router.get('/oauth/:provider/start', startOAuthHandler);
router.get('/oauth/debug', oauthDebugHandler);
router.get('/oauth/:provider/callback', oauthCallbackHandler);
router.delete('/oauth/:provider', unlinkOAuthHandler);

export { router as oauthRoutes };
