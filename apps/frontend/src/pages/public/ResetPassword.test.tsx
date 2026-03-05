import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ResetPassword from './ResetPassword';

const mockConfirmPasswordReset = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/api/auth', () => ({
  confirmPasswordReset: (...args: unknown[]) => mockConfirmPasswordReset(...args)
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
  useAuth: () => ({
    csrfToken: 'csrf-token'
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
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrubs token from URL while keeping token for submit', async () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    mockConfirmPasswordReset.mockResolvedValueOnce({ ok: true });

    renderPage('/reset-password?token=abc123');

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalled();
    });

    const replaceCall = replaceSpy.mock.calls.at(-1);
    expect(String(replaceCall?.[2] ?? '')).not.toContain('token=');

    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/i), {
      target: { value: 'StrongPass!123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmer/i }));

    await waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith({
        token: 'abc123',
        newPassword: 'StrongPass!123'
      });
    });
  });

  it('shows an error when token is missing', async () => {
    renderPage('/reset-password');

    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/i), {
      target: { value: 'StrongPass!123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmer/i }));

    await waitFor(() => {
      expect(screen.getByText(/Token invalide/i)).toBeInTheDocument();
    });
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled();
  });
});
