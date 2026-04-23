import type { Request, Response } from 'express';
import {
  clearAuthCookies,
  clearMfaChallengeCookie,
  clearOnboardingCookie
} from '../../../utils/cookies';
import { actionConfirmationSchema, resendEmailSchema } from '../schemas/email-security.schema';
import { sendValidationError } from '../shared/http';
import {
  confirmEmailChange,
  confirmEmailVerification,
  confirmRecoveryEmail,
  createEmailChangeConfirmation,
  createEmailVerificationConfirmation,
  createRecoveryEmailConfirmation,
  resendVerificationEmail
} from '../services/email-verification.service';
import {
  confirmSecurityAction,
  createSecurityActionConfirmation
} from '../services/security-actions.service';

export async function resendVerificationEmailHandler(req: Request, res: Response) {
  const parseResult = resendEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const result = await resendVerificationEmail(parseResult.data.email, { ip: req.ip ?? null }, req.id);
  res.status(200).json({
    message: result.message,
    request_id: req.id,
    ...(result.testToken ? { test_token: result.testToken } : {}),
    ...(result.emailSent !== undefined ? { email_sent: result.emailSent } : {})
  });
}

async function handleConfirmationGet(
  res: Response,
  requestId: string,
  factory: () => Promise<{ confirmationToken: string; requestId: string }>
) {
  try {
    const result = await factory();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ confirmation_token: result.confirmationToken, request_id: requestId });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALID') {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: requestId });
      return;
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: requestId });
      return;
    }
    if (error instanceof Error && error.message === 'EMAIL_UNAVAILABLE') {
      res.status(409).json({ error: 'EMAIL_UNAVAILABLE', message: 'Cet email est déjà pris.', request_id: requestId });
      return;
    }
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      res.status(400).json({ error: 'TOKEN_EXPIRED', request_id: requestId });
      return;
    }
    throw error;
  }
}

async function handleConfirmationPost(
  req: Request,
  res: Response,
  executor: (confirmationToken: string) => Promise<void>
) {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await executor(parseResult.data.confirmation_token);
    res.json({ ok: true, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALID') {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'EMAIL_UNAVAILABLE') {
      res.status(409).json({ error: 'EMAIL_UNAVAILABLE', message: 'Cet email est déjà pris.', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function getEmailVerificationHandler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await handleConfirmationGet(res, req.id, () => createEmailVerificationConfirmation(token, req.id));
}

export async function confirmEmailVerificationHandler(req: Request, res: Response) {
  await handleConfirmationPost(req, res, (confirmationToken) =>
    confirmEmailVerification(confirmationToken, { ip: req.ip ?? null }, req.id)
  );
}

export async function getRecoveryEmailVerificationHandler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await handleConfirmationGet(res, req.id, () => createRecoveryEmailConfirmation(token, req.id));
}

export async function confirmRecoveryEmailHandler(req: Request, res: Response) {
  await handleConfirmationPost(req, res, (confirmationToken) =>
    confirmRecoveryEmail(confirmationToken, { ip: req.ip ?? null }, req.id)
  );
}

export async function getSecurityRevokeSessionsHandler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await handleConfirmationGet(res, req.id, () => createSecurityActionConfirmation(token, 'REVOKE_SESSIONS', req.id));
}

export async function confirmSecurityRevokeSessionsHandler(req: Request, res: Response) {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  try {
    await confirmSecurityAction(parseResult.data.confirmation_token, 'REVOKE_SESSIONS', { ip: req.ip ?? null }, req.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_INVALID') {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
      return;
    }
    throw error;
  }

  clearAuthCookies(res);
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);
  res.json({ ok: true, request_id: req.id });
}

export async function getAcknowledgeSecurityAlertHandler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await handleConfirmationGet(res, req.id, () => createSecurityActionConfirmation(token, 'ACK_ALERT', req.id));
}

export async function confirmAcknowledgeSecurityAlertHandler(req: Request, res: Response) {
  await handleConfirmationPost(req, res, (confirmationToken) =>
    confirmSecurityAction(confirmationToken, 'ACK_ALERT', { ip: req.ip ?? null }, req.id)
  );
}

export async function getEmailChangeVerificationHandler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await handleConfirmationGet(res, req.id, () => createEmailChangeConfirmation(token, req.id));
}

export async function confirmEmailChangeHandler(req: Request, res: Response) {
  await handleConfirmationPost(req, res, (confirmationToken) =>
    confirmEmailChange(confirmationToken, { ip: req.ip ?? null }, req.id)
  );
}
