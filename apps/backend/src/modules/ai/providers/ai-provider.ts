export type AiOperation = 'resume_import' | 'resume_polish' | 'resume_grammar';

export type AiJsonResult = {
  data: unknown;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  readonly name: 'gemini' | 'mock';
  readonly model: string;
  generateJson(input: {
    operation: AiOperation;
    systemPrompt: string;
    userPrompt: string;
    timeoutMs: number;
    schemaName: string;
  }): Promise<AiJsonResult>;
  generateText(input: {
    operation: AiOperation;
    systemPrompt: string;
    userPrompt: string;
    timeoutMs: number;
  }): Promise<{ text: string; latencyMs: number }>;
}
