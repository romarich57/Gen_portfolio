import { describe, expect, it, vi, beforeEach } from 'vitest';

import { apiRequest, setAuthErrorHandler, setCsrfErrorHandler } from './http';
import { setCsrfToken } from './csrf';

const createResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === null ? '' : JSON.stringify(body))
});

/**
 * Tests for API request wrapper.
 * Preconditions: fetch mocked.
 * Postconditions: validates CSRF and auth handling.
 */
describe('apiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error mock fetch
    global.fetch = vi.fn();
  });

  it('adds CSRF token for state-changing requests', async () => {
    setCsrfToken('csrf-token');
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(createResponse(200, { ok: true }));

    await apiRequest('/test', { method: 'POST', body: JSON.stringify({}) });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token');
    expect(options.credentials).toBe('include');
  });

  it('invokes auth error handler on 401', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(createResponse(401, { error: 'AUTH_REQUIRED' }));

    await expect(apiRequest('/test', { method: 'GET' })).rejects.toBeDefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not invoke auth handler when skipAuthRedirect is true', async () => {
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(createResponse(401, { error: 'AUTH_REQUIRED' }));

    await expect(apiRequest('/test', { method: 'GET', skipAuthRedirect: true })).rejects.toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('invokes csrf handler on CSRF error', async () => {
    const handler = vi.fn();
    setCsrfErrorHandler(handler);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(createResponse(403, { error: 'CSRF_TOKEN_INVALID' }));

    await expect(apiRequest('/test', { method: 'POST', body: JSON.stringify({}) })).rejects.toBeDefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns a NETWORK_ERROR when fetch fails', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(apiRequest('/test', { method: 'GET' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0
    });
  });
});
