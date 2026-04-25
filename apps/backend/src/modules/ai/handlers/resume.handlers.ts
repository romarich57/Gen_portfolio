import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { writeAuditLog } from '../../../services/audit';
import { requireUserId, sendValidationError } from '../../resumes/shared/http';
import { aiResumeGrammarSchema, aiResumeImportSchema, aiResumePolishSchema } from '../schemas/resume.schema';
import { checkResumeGrammar, importResumeWithAi, polishResumeText } from '../services/resume-generation.service';
import { getAiUsageSummary } from '../services/usage.service';

export async function importResumeAiHandler(req: Request, res: Response) {
  const parsed = aiResumeImportSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const resume = await importResumeWithAi({ userId, ...parsed.data, requestId: req.id });
    await audit(req, userId, 'RESUME_AI_IMPORT_REQUESTED');
    res.json({ resume, request_id: req.id });
  } catch (error) {
    sendAiError(res, req.id, error);
  }
}

export async function polishResumeAiHandler(req: Request, res: Response) {
  const parsed = aiResumePolishSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const content = await polishResumeText({
      userId,
      content: parsed.data.content,
      section: parsed.data.section,
      instructions: parsed.data.custom_instructions,
      requestId: req.id
    });
    await audit(req, userId, 'RESUME_AI_POLISH_REQUESTED', { section: parsed.data.section });
    res.json({ content, request_id: req.id });
  } catch (error) {
    sendAiError(res, req.id, error);
  }
}

export async function grammarResumeAiHandler(req: Request, res: Response) {
  const parsed = aiResumeGrammarSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, req.id, parsed.error);
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const result = await checkResumeGrammar({ userId, ...parsed.data, requestId: req.id });
    await audit(req, userId, 'RESUME_AI_GRAMMAR_REQUESTED');
    res.json({ ...result, request_id: req.id });
  } catch (error) {
    sendAiError(res, req.id, error);
  }
}

export async function aiUsageHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  res.json({ usage: await getAiUsageSummary(userId), request_id: req.id });
}

function sendAiError(res: Response, requestId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'AI_FAILED';
  const code = ['AI_DISABLED', 'AI_PROVIDER_NOT_CONFIGURED'].includes(message) ? message : 'AI_FAILED';
  const status = code === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 502;
  res.status(status).json({ error: code, request_id: requestId });
}

async function audit(req: Request, userId: string, action: string, metadata: Prisma.InputJsonObject = {}) {
  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action,
    targetType: 'ai_usage',
    targetId: userId,
    metadata,
    requestId: req.id
  });
}
