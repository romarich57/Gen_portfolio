import type { Request, Response } from 'express';
import { clearAuthCookies } from '../../../utils/cookies';
import { resetConfirmSchema, resetRequestSchema, setPasswordSchema } from '../schemas/password.schema';
import { requireAccessUserId, sendValidationError } from '../shared/http';
import {
  confirmPasswordReset,
  requestPasswordReset,
  setPasswordForOAuthUser
} from '../services/password.service';

export async function requestPasswordResetHandler(req: Request, res: Response) {
  const parseResult = resetRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await requestPasswordReset(parseResult.data.email, parseResult.data.captchaToken, { ip: req.ip ?? null }, req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPTCHA_REQUIRED') {
      res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
      return;
    }
    throw error;
  }

  res.json({ message: 'If the account exists, a reset email has been sent.' });
}

export async function confirmPasswordResetHandler(req: Request, res: Response) {
  const parseResult = resetConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await confirmPasswordReset(parseResult.data.token, parseResult.data.newPassword, req.ip ?? null, req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALID') {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
      return;
    }
    throw error;
  }

  clearAuthCookies(res);
  res.json({ ok: true, request_id: req.id });
}

export async function setPasswordHandler(req: Request, res: Response) {
  const parseResult = setPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parseResult.error.issues[0]?.message,
      request_id: req.id
    });
    return;
  }

  const userId = requireAccessUserId(req, res);
  if (!userId) return;

  try {
    await setPasswordForOAuthUser(userId, parseResult.data.password, req.ip ?? null, req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'PASSWORD_ALREADY_SET') {
      res.status(400).json({
        error: 'PASSWORD_ALREADY_SET',
        message: 'Vous avez déjà un mot de passe. Utilisez la réinitialisation.',
        request_id: req.id
      });
      return;
    }
    throw error;
  }

  res.json({ ok: true, request_id: req.id });
}
