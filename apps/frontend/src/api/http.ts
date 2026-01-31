import { API_BASE_URL } from './config';
import { getCsrfToken } from './csrf';

export type ApiError = {
  code: string;
  message: string;
  requestId?: string;
  status: number;
  fields?: string[];
  issues?: { field: string; message: string }[];
};

export type ApiRequestOptions = RequestInit & {
  skipAuthRedirect?: boolean;
};

let authErrorHandler: (() => void) | null = null;
let csrfErrorHandler: (() => void) | null = null;

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Register a handler for authentication errors.
 * Preconditions: handler is stable and side-effect safe.
 * Postconditions: handler invoked when 401 occurs unless skipped.
 */
export function setAuthErrorHandler(handler: () => void) {
  authErrorHandler = handler;
}

/**
 * Register a handler for CSRF errors.
 * Preconditions: handler is stable and side-effect safe.
 * Postconditions: handler invoked when CSRF error occurs.
 */
export function setCsrfErrorHandler(handler: () => void) {
  csrfErrorHandler = handler;
}

/**
 * Normalize API errors from JSON responses.
 * Preconditions: response status not ok.
 * Postconditions: returns a stable error payload.
 */
function normalizeError(status: number, payload: unknown): ApiError {
  if (typeof payload === 'object' && payload !== null) {
    const errorCode = (payload as { error?: string }).error ?? 'REQUEST_FAILED';
    const requestId = (payload as { request_id?: string }).request_id;
    const fields = (payload as { fields?: string[] }).fields;
    const issues = (payload as { issues?: { field: string; message: string }[] }).issues;
    const error: ApiError = {
      code: errorCode,
      message: 'Request failed',
      status
    };
    if (typeof requestId === 'string') {
      error.requestId = requestId;
    }
    if (Array.isArray(fields)) {
      error.fields = fields;
    }
    if (Array.isArray(issues)) {
      error.issues = issues;
    }
    return error;
  }

  return {
    code: 'REQUEST_FAILED',
    message: 'Request failed',
    status
  };
}

/**
 * Safely parse JSON text.
 * Preconditions: text may be empty or non-JSON.
 * Postconditions: returns parsed object or null.
 */
function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Core API request wrapper with CSRF handling.
 * Preconditions: path starts with '/'.
 * Postconditions: returns parsed JSON or throws ApiError.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers ?? {});

  headers.set('Accept', 'application/json');

  const csrfToken = getCsrfToken();
  if (STATE_CHANGING_METHODS.has(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const body = options.body;
  const isJsonBody = body && !(body instanceof FormData);
  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
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
    throw {
      code: 'NETWORK_ERROR',
      message: 'Network error',
      status: 0
    } satisfies ApiError;
  }

  const hasBody = response.status !== 204;
  const text = hasBody ? await response.text() : '';
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && !options.skipAuthRedirect && authErrorHandler) {
      authErrorHandler();
    }
    if (
      response.status === 403 &&
      csrfErrorHandler &&
      payload &&
      typeof payload === 'object' &&
      ['CSRF_TOKEN_INVALID', 'CSRF_ORIGIN_INVALID', 'CSRF_ORIGIN_MISSING'].includes(
        (payload as { error?: string }).error ?? ''
      )
    ) {
      csrfErrorHandler();
    }
    throw normalizeError(response.status, payload);
  }

  return (payload ?? {}) as T;
}
