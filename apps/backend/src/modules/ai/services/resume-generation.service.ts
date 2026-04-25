import { AiOperation, AiUsageStatus } from '@prisma/client';
import { env } from '../../../config/env';
import { sanitizeResumeData } from '../../resumes/services/sanitize.service';
import { aiGrammarOutputSchema, aiResumeImportOutputSchema } from '../schemas/resume.schema';
import { getAiProvider } from './provider.service';
import { recordAiUsage } from './usage.service';

export async function importResumeWithAi(params: {
  userId: string;
  text: string;
  locale: 'fr' | 'en';
  requestId?: string | undefined;
}) {
  const provider = getAiProvider();
  const systemPrompt =
    params.locale === 'en'
      ? 'You extract resume content. Return only valid JSON matching the requested resume structure.'
      : 'Tu extrais le contenu de CV. Retourne uniquement un JSON valide conforme à la structure demandée.';

  try {
    const result = await provider.generateJson({
      operation: 'resume_import',
      systemPrompt,
      userPrompt: params.text,
      timeoutMs: env.aiTimeoutMs,
      schemaName: 'resumeImportOutput'
    });
    const parsed = aiResumeImportOutputSchema.parse(sanitizeResumeData(result.data));
    await recordAiUsage({
      userId: params.userId,
      operation: AiOperation.resume_import,
      provider: provider.name,
      model: provider.model,
      status: AiUsageStatus.succeeded,
      inputChars: params.text.length,
      latencyMs: result.latencyMs,
      requestId: params.requestId
    });
    return parsed;
  } catch (error) {
    await recordAiUsage({
      userId: params.userId,
      operation: AiOperation.resume_import,
      provider: provider.name,
      model: provider.model,
      status: AiUsageStatus.failed,
      inputChars: params.text.length,
      errorCode: error instanceof Error ? error.message.slice(0, 80) : 'AI_FAILED',
      requestId: params.requestId
    });
    throw error;
  }
}

export async function polishResumeText(params: {
  userId: string;
  content: string;
  section: string;
  instructions?: string | undefined;
  requestId?: string | undefined;
}) {
  const provider = getAiProvider();
  const systemPrompt = [
    'Tu es un assistant de rédaction de CV.',
    'Améliore le texte fourni sans inventer de faits.',
    'Retourne seulement le texte amélioré, sans préambule.'
  ].join(' ');
  const prompt = params.instructions ? `${params.content}\n\nContraintes: ${params.instructions}` : params.content;

  try {
    const result = await provider.generateText({
      operation: 'resume_polish',
      systemPrompt,
      userPrompt: prompt,
      timeoutMs: env.aiTimeoutMs
    });
    await recordAiUsage({
      userId: params.userId,
      operation: AiOperation.resume_polish,
      provider: provider.name,
      model: provider.model,
      status: AiUsageStatus.succeeded,
      inputChars: prompt.length,
      latencyMs: result.latencyMs,
      requestId: params.requestId
    });
    return sanitizeResumeData(result.text);
  } catch (error) {
    await recordAiUsage({
      userId: params.userId,
      operation: AiOperation.resume_polish,
      provider: provider.name,
      model: provider.model,
      status: AiUsageStatus.failed,
      inputChars: prompt.length,
      errorCode: error instanceof Error ? error.message.slice(0, 80) : 'AI_FAILED',
      requestId: params.requestId
    });
    throw error;
  }
}

export async function checkResumeGrammar(params: {
  userId: string;
  content: string;
  locale: 'fr' | 'en';
  requestId?: string | undefined;
}) {
  const provider = getAiProvider();
  const systemPrompt =
    params.locale === 'en'
      ? 'Find only spelling, punctuation, and grammar errors. Return valid JSON with an errors array.'
      : 'Trouve uniquement les fautes d’orthographe, de ponctuation et de grammaire. Retourne un JSON valide avec un tableau errors.';

  try {
    const result = await provider.generateJson({
      operation: 'resume_grammar',
      systemPrompt,
      userPrompt: params.content,
      timeoutMs: env.aiTimeoutMs,
      schemaName: 'resumeGrammarOutput'
    });
    const parsed = aiGrammarOutputSchema.parse(result.data);
    await recordAiUsage({
      userId: params.userId,
      operation: AiOperation.resume_grammar,
      provider: provider.name,
      model: provider.model,
      status: AiUsageStatus.succeeded,
      inputChars: params.content.length,
      latencyMs: result.latencyMs,
      requestId: params.requestId
    });
    return parsed;
  } catch (error) {
    await recordAiUsage({
      userId: params.userId,
      operation: AiOperation.resume_grammar,
      provider: provider.name,
      model: provider.model,
      status: AiUsageStatus.failed,
      inputChars: params.content.length,
      errorCode: error instanceof Error ? error.message.slice(0, 80) : 'AI_FAILED',
      requestId: params.requestId
    });
    throw error;
  }
}
