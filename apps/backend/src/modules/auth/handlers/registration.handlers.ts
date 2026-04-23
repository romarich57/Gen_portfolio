import type { Request, Response } from 'express';
import { registerSchema } from '../schemas/registration.schema';
import { getRequestMeta, sendValidationError } from '../shared/http';
import { registerUser } from '../services/registration.service';

export async function registerHandler(req: Request, res: Response) {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendValidationError(res, req.id);
    return;
  }

  const result = await registerUser(parseResult.data, getRequestMeta(req), req.id);
  res.status(201).json({
    message: result.message,
    ...(result.testToken ? { test_token: result.testToken } : {}),
    ...(result.emailSent !== undefined ? { email_sent: result.emailSent } : {})
  });
}
