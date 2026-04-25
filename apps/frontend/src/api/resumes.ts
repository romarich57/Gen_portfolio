import { apiRequest } from './http';

export type ResumeData = Record<string, unknown>;

export type ResumeSummary = {
  id: string;
  title: string;
  locale: 'fr' | 'en';
  template_id: string | null;
  status: string;
  data: ResumeData;
  version: number;
  created_at: string;
  updated_at: string;
};

export function listResumes() {
  return apiRequest<{ resumes: ResumeSummary[] }>('/api/resumes');
}

export function createResume(payload: { title?: string; locale?: 'fr' | 'en'; template_id?: string | null; data?: ResumeData | undefined }) {
  return apiRequest<{ resume: ResumeSummary }>('/api/resumes', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getResume(id: string) {
  return apiRequest<{ resume: ResumeSummary }>(`/api/resumes/${id}`);
}

export function updateResume(id: string, payload: {
  expected_version: number;
  title?: string;
  template_id?: string | null;
  data?: ResumeData | undefined;
}) {
  return apiRequest<{ resume: ResumeSummary }>(`/api/resumes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteResume(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/resumes/${id}`, {
    method: 'DELETE'
  });
}

export function duplicateResume(id: string) {
  return apiRequest<{ resume: ResumeSummary }>(`/api/resumes/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function requestResumeExport(id: string, format: 'json' | 'markdown' | 'pdf' | 'zip') {
  return apiRequest<{ export: { id: string; status: string; format: string } }>(`/api/resumes/${id}/exports`, {
    method: 'POST',
    body: JSON.stringify({ format })
  });
}

export function getResumeExportDownloadUrl(id: string, exportId: string) {
  return apiRequest<{ download_url: string }>(`/api/resumes/${id}/exports/${exportId}/download-url`);
}
