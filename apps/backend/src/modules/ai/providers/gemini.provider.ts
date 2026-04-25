import type { AiProvider, AiJsonResult } from './ai-provider';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async generateJson(input: {
    operation: string;
    systemPrompt: string;
    userPrompt: string;
    timeoutMs: number;
  }): Promise<AiJsonResult> {
    const start = Date.now();
    const text = await this.callGemini(input.systemPrompt, input.userPrompt, input.timeoutMs, 'application/json');
    return { data: parseJsonPayload(text), latencyMs: Date.now() - start };
  }

  async generateText(input: {
    systemPrompt: string;
    userPrompt: string;
    timeoutMs: number;
  }): Promise<{ text: string; latencyMs: number }> {
    const start = Date.now();
    const text = await this.callGemini(input.systemPrompt, input.userPrompt, input.timeoutMs, 'text/plain');
    return { text, latencyMs: Date.now() - start };
  }

  private async callGemini(
    systemPrompt: string,
    userPrompt: string,
    timeoutMs: number,
    responseMimeType: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType }
          })
        }
      );
      if (!response.ok) {
        throw new Error(`AI_UPSTREAM_${response.status}`);
      }
      const payload = (await response.json()) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      if (!text) throw new Error('AI_EMPTY_RESPONSE');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJsonPayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());
    const objectBlock = raw.match(/\{[\s\S]*\}/);
    if (objectBlock?.[0]) return JSON.parse(objectBlock[0]);
    throw new Error('AI_INVALID_JSON');
  }
}
