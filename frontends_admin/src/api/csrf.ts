import { ADMIN_API_BASE_URL } from './config';

let csrfToken: string | null = null;

export function getCsrfToken() {
  return csrfToken;
}

export async function refreshCsrfToken() {
  const res = await fetch(`${ADMIN_API_BASE_URL}/auth/csrf`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('CSRF_FETCH_FAILED');
  }
  const data = (await res.json()) as { csrfToken?: string };
  csrfToken = data.csrfToken ?? null;
  return csrfToken;
}

export function setCsrfToken(value: string | null) {
  csrfToken = value;
}
