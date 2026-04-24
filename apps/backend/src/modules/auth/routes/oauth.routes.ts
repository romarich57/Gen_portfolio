import { Router } from 'express';
import {
  oauthCallbackHandler,
  confirmOAuthLinkHandler,
  getOAuthLinkVerificationHandler,
  oauthDebugHandler,
  startOAuthHandler,
  unlinkOAuthHandler
} from '../handlers/oauth.handlers';

const router = Router();

router.get('/oauth/:provider/start', startOAuthHandler);
router.get('/oauth/debug', oauthDebugHandler);
router.get('/oauth/:provider/callback', oauthCallbackHandler);
router.get('/oauth/link/verify', getOAuthLinkVerificationHandler);
router.post('/oauth/link/verify', confirmOAuthLinkHandler);
router.post('/oauth/link/confirm', confirmOAuthLinkHandler);
router.delete('/oauth/:provider', unlinkOAuthHandler);

export { router as oauthRoutes };
