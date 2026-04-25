import { env } from '../../../config/env';
import { GeminiProvider } from '../providers/gemini.provider';
import { MockAiProvider } from '../providers/mock.provider';
import type { AiProvider } from '../providers/ai-provider';

export function getAiProvider(): AiProvider {
  if (!env.aiEnabled) {
    throw new Error('AI_DISABLED');
  }
  if (env.aiProvider === 'mock') {
    return new MockAiProvider();
  }
  if (!env.geminiApiKey) {
    throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  }
  return new GeminiProvider(env.geminiApiKey, env.geminiModel);
}
