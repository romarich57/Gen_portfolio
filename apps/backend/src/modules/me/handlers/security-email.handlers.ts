import type { Request, Response } from 'express';
import { writeAuditLog } from '../../../services/audit';
import { env } from '../../../config/env';
import {
  changeEmailSchema,
  changePasswordSchema,
  recoveryEmailRemoveSchema,
  recoveryEmailSchema,
  securityAlertsSchema
} from '../schemas/security-email.schema';
import { requireUserId } from '../shared/http';
import {
  changePasswordForUser,
  regenerateBackupCodesForUser,
  removeRecoveryEmailForUser,
  requestEmailChangeForUser,
  requestRecoveryEmailForUser,
  updateSecurityAlertsForUser
} from '../services/security-email.service';

export async function regenerateBackupCodesHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const backupCodes = await regenerateBackupCodesForUser(userId);

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'BACKUP_CODES_REGENERATED',
      targetType: 'user',
      targetId: userId,
      metadata: {},
      requestId: req.id
    });

    res.json({ backup_codes: backupCodes, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'MFA_STEP_UP_REQUIRED') {
      res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'MFA_NOT_CONFIGURED') {
      res.status(400).json({ error: 'MFA_NOT_CONFIGURED', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function updateSecurityAlertsHandler(req: Request, res: Response) {
  const parseResult = securityAlertsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    await updateSecurityAlertsForUser({
      userId,
      ...parseResult.data
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'PHONE_NOT_VERIFIED') {
      res.status(400).json({ error: 'PHONE_NOT_VERIFIED', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'SMS_NOT_AVAILABLE') {
      res.status(400).json({ error: 'SMS_NOT_AVAILABLE', request_id: req.id });
      return;
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'SECURITY_ALERTS_UPDATED',
    targetType: 'user',
    targetId: userId,
    metadata: {
      email_enabled: parseResult.data.email_enabled,
      sms_enabled: parseResult.data.sms_enabled
    },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
}

export async function requestRecoveryEmailHandler(req: Request, res: Response) {
  const parseResult = recoveryEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await requestRecoveryEmailForUser({
      userId,
      ...parseResult.data
    });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'RECOVERY_EMAIL_REQUESTED',
      targetType: 'user',
      targetId: userId,
      metadata: { email_sent: result.emailSent },
      requestId: req.id
    });

    res.json({
      ok: true,
      email_sent: result.emailSent,
      request_id: req.id,
      ...(env.isTest ? { test_token: result.rawToken } : {})
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'PASSWORD_REQUIRED') {
      res.status(400).json({ error: 'PASSWORD_REQUIRED', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      res.status(401).json({ error: 'INVALID_PASSWORD', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'MFA_STEP_UP_REQUIRED') {
      res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'RECOVERY_EMAIL_TAKEN') {
      res.status(409).json({ error: 'RECOVERY_EMAIL_TAKEN', request_id: req.id });
      return;
    }
    throw error;
  }
}

export async function removeRecoveryEmailHandler(req: Request, res: Response) {
  const parseResult = recoveryEmailRemoveSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    await removeRecoveryEmailForUser({
      userId,
      ...parseResult.data
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'PASSWORD_REQUIRED') {
      res.status(400).json({ error: 'PASSWORD_REQUIRED', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      res.status(401).json({ error: 'INVALID_PASSWORD', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'MFA_STEP_UP_REQUIRED') {
      res.status(403).json({ error: 'MFA_STEP_UP_REQUIRED', request_id: req.id });
      return;
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'RECOVERY_EMAIL_REMOVED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
}

export async function changePasswordHandler(req: Request, res: Response) {
  const parseResult = changePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parseResult.error.issues[0]?.message,
      request_id: req.id
    });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    await changePasswordForUser({
      userId,
      currentPassword: parseResult.data.currentPassword,
      newPassword: parseResult.data.newPassword
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'NO_PASSWORD_SET') {
      res.status(400).json({
        error: 'NO_PASSWORD_SET',
        message: 'Vous devez d\'abord définir un mot de passe.',
        request_id: req.id
      });
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Mot de passe actuel incorrect',
        request_id: req.id
      });
      return;
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'PASSWORD_CHANGED',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
}

export async function requestEmailChangeHandler(req: Request, res: Response) {
  const parseResult = changeEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await requestEmailChangeForUser({
      userId,
      ...parseResult.data,
      requestedIp: req.ip ?? null
    });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: req.ip ?? null,
      action: 'EMAIL_CHANGE_REQUESTED',
      targetType: 'user',
      targetId: userId,
      metadata: { new_email: result.normalizedEmail },
      requestId: req.id
    });

    res.json({
      ok: true,
      request_id: req.id,
      ...(env.isTest
        ? {
            test_token: result.verifyToken,
            test_cancel_token: result.cancelToken
          }
        : {})
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'PASSWORD_REQUIRED') {
      res.status(400).json({
        error: 'PASSWORD_REQUIRED',
        message: 'Mot de passe requis pour changer d\'email.',
        request_id: req.id
      });
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Mot de passe incorrect',
        request_id: req.id
      });
      return;
    }
    if (error instanceof Error && error.message === 'MFA_STEP_UP_REQUIRED') {
      res.status(403).json({
        error: 'MFA_STEP_UP_REQUIRED',
        request_id: req.id
      });
      return;
    }
    if (error instanceof Error && error.message === 'EMAIL_UNAVAILABLE') {
      res.status(409).json({
        error: 'EMAIL_UNAVAILABLE',
        message: 'Cet email est déjà utilisé.',
        request_id: req.id
      });
      return;
    }
    throw error;
  }
}
