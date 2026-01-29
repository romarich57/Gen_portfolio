import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import Profile from './Profile';
import QueryProvider from '@/app/providers/QueryProvider';
import { ToastProvider } from '@/components/common/ToastProvider';

const mockGetMe = vi.fn();
const mockGetOnboarding = vi.fn();
const mockPatchOnboarding = vi.fn();
const mockPatchMe = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock('@/api/me', () => ({
  getMe: (...args: any[]) => mockGetMe(...args),
  getOnboardingStatus: (...args: any[]) => mockGetOnboarding(...args),
  patchOnboarding: (...args: any[]) => mockPatchOnboarding(...args),
  patchMe: (...args: any[]) => mockPatchMe(...args)
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      first_name: null,
      last_name: null,
      username: null,
      nationality: null,
      locale: null,
      roles: ['user'],
      avatar_url: null,
      mfa_enabled: false,
      mfa_required: false,
      onboarding_completed_at: null,
      deleted_at: null
    },
    refreshUser: mockRefreshUser,
    csrfToken: 'csrf-token'
  })
}));

function renderProfile() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <QueryProvider>
          <Profile />
        </QueryProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('Profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMe.mockResolvedValue({
      profile: {
        id: 'user-1',
        email: 'test@example.com',
        first_name: null,
        last_name: null,
        username: null,
        nationality: null,
        locale: null,
        roles: ['user'],
        avatar_url: null,
        mfa_enabled: false,
        mfa_required: false,
        onboarding_completed_at: null,
        deleted_at: null
      }
    });
    mockGetOnboarding.mockResolvedValue({
      completed: false,
      missing_fields: ['first_name', 'last_name', 'username', 'nationality'],
      onboarding_completed_at: null
    });
  });

  it('shows inline field errors for onboarding validation', async () => {
    mockPatchOnboarding.mockRejectedValueOnce({
      code: 'VALIDATION_ERROR',
      status: 400,
      fields: ['nationality'],
      issues: [{ field: 'nationality', message: 'country_invalid' }]
    });

    renderProfile();

    const onboardingSection = screen.getByRole('heading', { name: /Onboarding obligatoire/i }).closest('section');
    if (!onboardingSection) {
      throw new Error('Onboarding section not found');
    }
    const scope = within(onboardingSection);

    fireEvent.change(scope.getByLabelText(/Prenom/i), { target: { value: 'Romaric' } });
    fireEvent.change(scope.getByLabelText(/^Nom$/i), { target: { value: 'Heitz' } });
    fireEvent.change(scope.getByLabelText(/Nom d'utilisateur/i), { target: { value: 'romaric' } });
    fireEvent.change(scope.getByRole('combobox', { name: /Nationalite/i }), { target: { value: 'FR' } });

    fireEvent.click(scope.getByRole('button', { name: /Valider l'onboarding/i }));

    await waitFor(() => {
      expect(screen.getByText(/Code pays ISO2 invalide/i)).toBeInTheDocument();
    });
  });
});
