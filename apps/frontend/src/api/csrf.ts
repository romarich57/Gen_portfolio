import { API_BASE_URL } from './config';

let csrfToken: string | null = null;

/**
 * Store CSRF token in memory only.
 * Preconditions: token is a non-empty string.
 * Postconditions: in-memory token is updated.
 */
export function setCsrfToken(token: string) {
  csrfToken = token;
}

/**
 * Return current in-memory CSRF token.
 * Preconditions: none.
 * Postconditions: returns token or null.
 */
export function getCsrfToken() {
  return csrfToken;
}

/**
 * Clear CSRF token from memory.
 * Preconditions: none.
 * Postconditions: token removed.
 */
export function clearCsrfToken() {
  csrfToken = null;
}

/**
 * Fetch CSRF token from backend and store it in memory.
 * Preconditions: backend reachable.
 * Postconditions: token stored in memory and returned.
 */
export async function fetchCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('CSRF_FETCH_FAILED');
  }

  const data = (await response.json()) as { csrfToken?: string };
  if (!data.csrfToken) {
    throw new Error('CSRF_TOKEN_MISSING');
  }

  setCsrfToken(data.csrfToken);
  return data.csrfToken;
}
