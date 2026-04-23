import type { Request, Response } from 'express';
import { ACCESS_COOKIE_NAME } from '../../../config/auth';
import { clearOnboardingCookie, setAuthCookies } from '../../../utils/cookies';
import { phoneCheckSchema, phoneStartSchema } from '../schemas/phone.schema';
import {
  getRequestMeta,
  requireAccessOrOnboardingUserId,
  sendValidationError
} from '../shared/http';
import {
  confirmPhoneVerificationForUser,
  startPhoneVerificationForUser
} from '../services/phone.service';

function getPhoneMeta(req: Request) {
  return {
    ...getRequestMeta(req),
    acceptLanguage: typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : undefined
  };
}

export async function startPhoneVerificationHandler(req: Request, res: Response) {
  const userId = requireAccessOrOnboardingUserId(req, res, 'phone');
  if (!userId) return;

  const parseResult = phoneStartSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await startPhoneVerificationForUser(userId, parseResult.data, req.body?.captchaToken, getPhoneMeta(req), req.id);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === 'VALIDATION_ERROR') {
      sendValidationError(res, req.id);
      return;
    }
    if (error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    if (error.message === 'PHONE_VERIFY_FAILED') {
      res.status(502).json({ error: 'PHONE_VERIFY_FAILED', request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}

export async function checkPhoneVerificationHandler(req: Request, res: Response) {
  const userId = requireAccessOrOnboardingUserId(req, res, 'phone');
  if (!userId) return;

  const parseResult = phoneCheckSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    const session = await confirmPhoneVerificationForUser(
      userId,
      parseResult.data,
      req.body?.captchaToken,
      getPhoneMeta(req),
      req.id
    );

    const hasAccessToken = Boolean(req.cookies?.[ACCESS_COOKIE_NAME]);
    if (!hasAccessToken) {
      setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === 'VALIDATION_ERROR') {
      sendValidationError(res, req.id);
      return;
    }
    if (error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    if (error.message === 'PHONE_VERIFY_NOT_STARTED' || error.message === 'PHONE_VERIFY_EXPIRED') {
      res.status(400).json({ error: error.message, request_id: req.id });
      return;
    }
    if (error.message === 'PHONE_VERIFY_LOCKED') {
      res.status(429).json({ error: 'PHONE_VERIFY_LOCKED', request_id: req.id });
      return;
    }
    if (error.message === 'PHONE_VERIFY_FAILED') {
      res.status(400).json({ error: 'PHONE_VERIFY_FAILED', request_id: req.id });
      return;
    }
    if (error.message === 'PHONE_VERIFY_FAILED_PROVIDER') {
      res.status(502).json({ error: 'PHONE_VERIFY_FAILED', request_id: req.id });
      return;
    }
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }

  clearOnboardingCookie(res);
  res.json({ ok: true, request_id: req.id });
}
