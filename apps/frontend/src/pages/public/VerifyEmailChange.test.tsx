import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import VerifyEmailChange from './VerifyEmailChange';

const mockVerifyEmailChange = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/api/auth', () => ({
  verifyEmailChange: (...args: unknown[]) => mockVerifyEmailChange(...args)
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
  useAuth: () => ({
    user: null
  })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

function renderPage(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/verify-email-change" element={<VerifyEmailChange />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VerifyEmailChange page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when token is missing', async () => {
    renderPage('/verify-email-change');

    await waitFor(() => {
      expect(screen.getByText(/Lien de verification manquant/i)).toBeInTheDocument();
    });
    expect(mockVerifyEmailChange).not.toHaveBeenCalled();
  });

  it('verifies token and displays success state', async () => {
    mockVerifyEmailChange.mockResolvedValueOnce({ ok: true });
    renderPage('/verify-email-change?token=abc123');

    await waitFor(() => {
      expect(mockVerifyEmailChange).toHaveBeenCalledWith('abc123');
    });

    expect(await screen.findByText(/Nouvel email confirme/i)).toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    mockVerifyEmailChange.mockRejectedValueOnce({ code: 'TOKEN_INVALID' });
    renderPage('/verify-email-change?token=bad-token');

    await waitFor(() => {
      expect(mockVerifyEmailChange).toHaveBeenCalledWith('bad-token');
    });

    expect(await screen.findByText(/Lien de verification invalide ou expire/i)).toBeInTheDocument();
  });
});
