import type { Request, Response } from 'express';
import { ACCESS_COOKIE_NAME } from '../../../config/auth';
import { env } from '../../../config/env';
import {
  clearAuthCookies,
  clearMfaChallengeCookie,
  clearOnboardingCookie,
  cookieOAuthOptions,
  setAuthCookies,
  setMfaChallengeCookie,
  setOnboardingCookie
} from '../../../utils/cookies';
import { oauthProviderSchema, unlinkOAuthSchema } from '../schemas/oauth.schema';
import {
  completeOAuthCallback
} from '../services/oauth-callback.service';
import {
  confirmOAuthLink,
  createOAuthLinkConfirmation
} from '../services/oauth-link.service';
import {
  getAuthenticatedOAuthUserId,
  getOAuthDebugData,
  startOAuthFlow,
  unlinkOAuthProvider,
  writeOAuthStartAudit
} from '../services/oauth.service';

export async function startOAuthHandler(req: Request, res: Response) {
  const providerParse = oauthProviderSchema.safeParse(req.params.provider);
  if (!providerParse.success) {
    res.status(400).json({ error: 'OAUTH_PROVIDER_INVALID', request_id: req.id });
    return;
  }

  const { state, nonce, verifier, authorizationUrl } = startOAuthFlow(providerParse.data);

  res.cookie(`oauth_state_${providerParse.data}`, state, {
    ...cookieOAuthOptions(),
    maxAge: 10 * 60 * 1000,
    signed: true
  });
  res.cookie(`oauth_nonce_${providerParse.data}`, nonce, {
    ...cookieOAuthOptions(),
    maxAge: 10 * 60 * 1000,
    signed: true
  });
  res.cookie(`oauth_verifier_${providerParse.data}`, verifier, {
    ...cookieOAuthOptions(),
    maxAge: 10 * 60 * 1000,
    signed: true
  });

  await writeOAuthStartAudit(providerParse.data, req.ip ?? null, req.id);
  res.redirect(authorizationUrl);
}

export function oauthDebugHandler(req: Request, res: Response) {
  try {
    const data = getOAuthDebugData(req.ip ?? '', req.id);
    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function oauthCallbackHandler(req: Request, res: Response) {
  const providerParse = oauthProviderSchema.safeParse(req.params.provider);
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;

  const redirectOAuthError = (reason?: string) => {
    const query = new URLSearchParams({
      status: 'error',
      request_id: req.id,
      ...(reason ? { reason } : {})
    }).toString();
    res.redirect(`${env.appBaseUrl}/oauth/callback?${query}`);
  };

  if (!providerParse.success || !code || !state) {
    redirectOAuthError();
    return;
  }

  const provider = providerParse.data;
  const stateCookie = req.signedCookies?.[`oauth_state_${provider}`] as string | undefined;
  const nonceCookie = req.signedCookies?.[`oauth_nonce_${provider}`] as string | undefined;
  const verifierCookie = req.signedCookies?.[`oauth_verifier_${provider}`] as string | undefined;

  if (stateCookie && nonceCookie && verifierCookie && stateCookie === state) {
    res.clearCookie(`oauth_state_${provider}`, { ...cookieOAuthOptions(), signed: true });
    res.clearCookie(`oauth_nonce_${provider}`, { ...cookieOAuthOptions(), signed: true });
    res.clearCookie(`oauth_verifier_${provider}`, { ...cookieOAuthOptions(), signed: true });
  }

  const result = await completeOAuthCallback({
    provider,
    code,
    state,
    stateCookie,
    nonceCookie,
    verifierCookie,
    meta: {
      ip: req.ip ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
    },
    requestId: req.id
  });

  const redirectToFrontend = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    res.redirect(`${env.appBaseUrl}/oauth/callback?${query}`);
  };

  if (result.kind === 'redirect_error') {
    redirectToFrontend({
      status: 'error',
      request_id: req.id,
      ...(result.reason ? { reason: result.reason } : {})
    });
    return;
  }

  if (result.kind === 'mfa_challenge') {
    clearAuthCookies(res);
    clearOnboardingCookie(res);
    setMfaChallengeCookie(res, result.userId);
    redirectToFrontend({ next: 'mfa-challenge' });
    return;
  }

  if (result.next === 'setup-mfa') {
    clearAuthCookies(res);
    setOnboardingCookie(res, result.onboardingUserId, 'mfa');
    clearMfaChallengeCookie(res);
    redirectToFrontend({ next: result.next });
    return;
  }

  setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);
  redirectToFrontend({ next: result.next });
}

export async function getOAuthLinkVerificationHandler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  try {
    const result = await createOAuthLinkConfirmation(token, req.id);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ confirmation_token: result.confirmationToken, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALID') {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      res.status(400).json({ error: 'TOKEN_EXPIRED', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function confirmOAuthLinkHandler(req: Request, res: Response) {
  const confirmationToken = typeof req.body?.confirmation_token === 'string' ? req.body.confirmation_token : null;
  if (!confirmationToken) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  try {
    await confirmOAuthLink(confirmationToken, { ip: req.ip ?? null }, req.id);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALID') {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      res.status(400).json({ error: 'TOKEN_EXPIRED', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function unlinkOAuthHandler(req: Request, res: Response) {
  const parseResult = unlinkOAuthSchema.safeParse({ provider: req.params.provider });
  if (!parseResult.success) {
    res.status(400).json({ error: 'INVALID_PROVIDER', request_id: req.id });
    return;
  }

  let userId: string;
  try {
    userId = getAuthenticatedOAuthUserId(req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined);
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
      return;
    }
    throw error;
  }

  try {
    await unlinkOAuthProvider(userId, parseResult.data.provider, req.ip ?? null, req.id);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error.message === 'PROVIDER_NOT_LINKED') {
      res.status(400).json({ error: 'PROVIDER_NOT_LINKED', request_id: req.id });
      return;
    }
    if (error.message === 'NEED_PASSWORD_FIRST') {
      res.status(400).json({
        error: 'NEED_PASSWORD_FIRST',
        message: 'Vous devez définir un mot de passe avant de déconnecter ce provider.',
        request_id: req.id
      });
      return;
    }
    if (error.message === 'NEED_EMAIL_VERIFIED') {
      res.status(400).json({
        error: 'NEED_EMAIL_VERIFIED',
        message: 'Vous devez vérifier votre email avant de déconnecter ce provider.',
        request_id: req.id
      });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}
