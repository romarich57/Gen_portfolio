import type { Request, Response } from 'express';
import {
  clearAuthCookies,
  clearMfaChallengeCookie,
  clearOnboardingCookie,
  setAuthCookies,
  setMfaChallengeCookie,
  setOnboardingCookie
} from '../../../utils/cookies';
import { REFRESH_COOKIE_NAME } from '../../../config/auth';
import { loginSchema } from '../schemas/session.schema';
import { getRequestMeta, sendValidationError } from '../shared/http';
import { loginUser, logoutUser, refreshUserSession } from '../services/session.service';

export async function loginHandler(req: Request, res: Response) {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const result = await loginUser(parseResult.data, getRequestMeta(req), req.id);
    if (result.kind === 'mfa_setup_required') {
      clearAuthCookies(res);
      setOnboardingCookie(res, result.userId, 'mfa');
      res.status(403).json({ error: 'MFA_SETUP_REQUIRED', request_id: req.id });
      return;
    }

    if (result.kind === 'mfa_challenge_required') {
      setMfaChallengeCookie(res, result.userId);
      res.status(200).json({ error: 'MFA_CHALLENGE_REQUIRED', request_id: req.id });
      return;
    }

    setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    clearOnboardingCookie(res);
    clearMfaChallengeCookie(res);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function logoutHandler(req: Request, res: Response) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await logoutUser(refreshToken, req.ip ?? null, req.id);
  clearAuthCookies(res);
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);
  res.status(204).send();
}

export async function refreshHandler(req: Request, res: Response) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    res.status(401).json({ error: 'REFRESH_TOKEN_MISSING', request_id: req.id });
    return;
  }

  try {
    const result = await refreshUserSession(refreshToken, getRequestMeta(req), req.id);
    if (result.kind === 'mfa_setup_required') {
      clearAuthCookies(res);
      setOnboardingCookie(res, result.userId, 'mfa');
      res.status(403).json({ error: 'MFA_SETUP_REQUIRED', request_id: req.id });
      return;
    }
    setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    if (error.message === 'REFRESH_REUSE_DETECTED') {
      clearAuthCookies(res);
      res.status(401).json({ error: 'REFRESH_REUSE_DETECTED', request_id: req.id });
      return;
    }

    const knownErrors = new Set([
      'REFRESH_TOKEN_INVALID',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_EXPIRED',
      'SESSION_IDLE_TIMEOUT',
      'SESSION_REAUTH_REQUIRED',
      'AUTH_REQUIRED'
    ]);
    if (knownErrors.has(error.message)) {
      res.status(401).json({ error: error.message, request_id: req.id });
      return;
    }
    throw error;
  }
}
