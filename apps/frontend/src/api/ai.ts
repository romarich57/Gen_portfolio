import { apiRequest } from './http';
import type { ResumeData } from './resumes';

export function importResumeWithAi(payload: { text: string; locale?: 'fr' | 'en' }) {
  return apiRequest<{ resume: ResumeData }>('/api/ai/resume/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function polishResumeText(payload: { content: string; section?: string; custom_instructions?: string }) {
  return apiRequest<{ content: string }>('/api/ai/resume/polish', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function checkResumeGrammar(payload: { content: string; locale?: 'fr' | 'en' }) {
  return apiRequest<{ errors: Array<{ text: string; suggestion: string; reason: string }> }>('/api/ai/resume/grammar', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
