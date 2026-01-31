import { apiRequest } from './http';

vi.mock('./csrf', () => ({
  getCsrfToken: () => 'csrf-token'
}));

describe('apiRequest', () => {
  it('adds CSRF header and credentials for state-changing requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}')
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await apiRequest('/api/admin/test', { method: 'POST', body: '{}' });

    expect(fetchSpy).toHaveBeenCalled();
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.credentials).toBe('include');
    expect((options.headers as Headers).get('X-CSRF-Token')).toBe('csrf-token');
  });

  it('throws normalized error on failure', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({ error: 'FORBIDDEN', request_id: 'req-1' }))
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(apiRequest('/api/admin/test')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
      requestId: 'req-1'
    });
  });
});
