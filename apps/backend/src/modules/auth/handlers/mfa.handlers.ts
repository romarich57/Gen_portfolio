import type { Request, Response } from 'express';
import {
  clearMfaChallengeCookie,
  clearOnboardingCookie,
  setAuthCookies
} from '../../../utils/cookies';
import { mfaSetupConfirmSchema, mfaVerifySchema } from '../schemas/mfa.schema';
import {
  getRequestMeta,
  requireAccessOrOnboardingUserId,
  requireMfaChallengeUserId,
  respondMfaLockout,
  sendValidationError
} from '../shared/http';
import { confirmMfaSetup, startMfaSetup, verifyMfaChallenge } from '../services/mfa.service';

function parseMfaLockout(error: Error) {
  if (!error.message.startsWith('MFA_TEMP_LOCKED:')) {
    return null;
  }

  const retryAfterSeconds = Number(error.message.split(':')[1] ?? '0');
  return Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 0;
}

export async function startMfaSetupHandler(req: Request, res: Response) {
  const userId = requireAccessOrOnboardingUserId(req, res, 'mfa');
  if (!userId) return;

  try {
    const result = await startMfaSetup(userId, req.ip ?? null, req.id);
    res.json({ otpauthUrl: result.otpauthUrl, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function confirmMfaSetupHandler(req: Request, res: Response) {
  const userId = requireAccessOrOnboardingUserId(req, res, 'mfa');
  if (!userId) return;

  const parseResult = mfaSetupConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const result = await confirmMfaSetup(
      userId,
      parseResult.data.code,
      parseResult.data.captchaToken,
      getRequestMeta(req),
      req.id
    );

    setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    clearOnboardingCookie(res);
    res.json({ backupCodes: result.backupCodes, request_id: req.id });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const retryAfterSeconds = parseMfaLockout(error);
    if (retryAfterSeconds !== null) {
      respondMfaLockout(res, req.id, retryAfterSeconds);
      return;
    }
    if (error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    if (error.message === 'MFA_SETUP_REQUIRED' || error.message === 'MFA_CODE_INVALID') {
      res.status(400).json({ error: error.message, request_id: req.id });
      return;
    }
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function verifyMfaChallengeHandler(req: Request, res: Response) {
  const userId = requireMfaChallengeUserId(req, res);
  if (!userId) return;

  const parseResult = mfaVerifySchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const result = await verifyMfaChallenge(
      userId,
      parseResult.data.code,
      parseResult.data.captchaToken,
      getRequestMeta(req),
      req.id
    );

    setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    clearMfaChallengeCookie(res);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const retryAfterSeconds = parseMfaLockout(error);
    if (retryAfterSeconds !== null) {
      respondMfaLockout(res, req.id, retryAfterSeconds);
      return;
    }
    if (error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    if (error.message === 'MFA_NOT_CONFIGURED' || error.message === 'MFA_CODE_INVALID') {
      res.status(400).json({ error: error.message, request_id: req.id });
      return;
    }
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
}
