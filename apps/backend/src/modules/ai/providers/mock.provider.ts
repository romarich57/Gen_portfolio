import type { AiProvider } from './ai-provider';

export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-resume-model';

  async generateJson(input: { operation: string; userPrompt: string }): Promise<{ data: unknown; latencyMs: number }> {
    if (input.operation === 'resume_grammar') {
      return { data: { errors: [] }, latencyMs: 1 };
    }

    return {
      data: {
        title: 'CV généré',
        basic: {
          name: '',
          title: 'Profil professionnel',
          email: '',
          phone: '',
          location: '',
          birthDate: '',
          employementStatus: ''
        },
        education: [],
        experience: [
          {
            id: 'exp-1',
            company: 'Expérience importée',
            position: 'Poste',
            date: '',
            details: `<ul><li>${escapeHtml(input.userPrompt.slice(0, 200))}</li></ul>`,
            visible: true
          }
        ],
        projects: [],
        certificates: [],
        customData: {},
        skillContent: '',
        selfEvaluationContent: '',
        menuSections: [],
        globalSettings: {}
      },
      latencyMs: 1
    };
  }

  async generateText(input: { userPrompt: string }): Promise<{ text: string; latencyMs: number }> {
    return { text: input.userPrompt.trim(), latencyMs: 1 };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
