import { ADMIN_API_BASE_URL } from './config';
import { getCsrfToken } from './csrf';

export type ApiError = {
  code: string;
  message: string;
  status: number;
  requestId?: string;
  fields?: string[];
};

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeError(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === 'object') {
    const errorCode = (payload as { error?: string }).error ?? 'REQUEST_FAILED';
    const requestId = (payload as { request_id?: string }).request_id;
    const fields = (payload as { fields?: string[] }).fields;
    const result: ApiError = { code: errorCode, message: 'Request failed', status };
    if (requestId) result.requestId = requestId;
    if (fields) result.fields = fields;
    return result;
  }
  return { code: 'REQUEST_FAILED', message: 'Request failed', status };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${ADMIN_API_BASE_URL}${path}`;
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers ?? {});
  headers.set('Accept', 'application/json');

  const csrfToken = getCsrfToken();
  if (STATE_CHANGING_METHODS.has(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });
  } catch {
    throw { code: 'NETWORK_ERROR', message: 'Network error', status: 0 } satisfies ApiError;
  }

  const text = response.status === 204 ? '' : await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw normalizeError(response.status, payload);
  }

  return (payload ?? {}) as T;
}
