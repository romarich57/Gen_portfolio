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
const mockGetSessions = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock('@/api/me', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  getOnboardingStatus: (...args: unknown[]) => mockGetOnboarding(...args),
  patchOnboarding: (...args: unknown[]) => mockPatchOnboarding(...args),
  patchMe: (...args: unknown[]) => mockPatchMe(...args),
  getSessions: (...args: unknown[]) => mockGetSessions(...args)
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
      email_verified_at: null,
      phone_verified_at: null,
      recovery_email: null,
      recovery_email_verified_at: null,
      recovery_email_pending: null,
      security_alert_email_enabled: false,
      security_alert_sms_enabled: false,
      backup_codes_remaining: 0,
      onboarding_completed_at: null,
      deleted_at: null,
      connected_accounts: []
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
        email_verified_at: null,
        phone_verified_at: null,
        recovery_email: null,
        recovery_email_verified_at: null,
        recovery_email_pending: null,
        security_alert_email_enabled: false,
        security_alert_sms_enabled: false,
        backup_codes_remaining: 0,
        onboarding_completed_at: null,
        deleted_at: null,
        connected_accounts: []
      }
    });
    mockGetOnboarding.mockResolvedValue({
      completed: false,
      missing_fields: ['first_name', 'last_name', 'username', 'nationality'],
      onboarding_completed_at: null
    });
    mockGetSessions.mockResolvedValue({ sessions: [] });
  });

  it('shows inline field errors for onboarding validation', async () => {
    mockPatchOnboarding.mockRejectedValueOnce({
      code: 'VALIDATION_ERROR',
      status: 400,
      fields: ['nationality'],
      issues: [{ field: 'nationality', message: 'country_invalid' }]
    });
    renderProfile();
    const onboardingHeading = await screen.findByText(/Onboarding requis/i);
    expect(onboardingHeading).toBeInTheDocument();
    const onboardingForm = await screen.findByRole('form', { name: /Onboarding form/i });
    const scope = within(onboardingForm);

    fireEvent.change(scope.getByLabelText(/Prénom/i), { target: { value: 'Romaric' } });
    fireEvent.change(scope.getByLabelText(/^Nom$/i), { target: { value: 'Heitz' } });
    fireEvent.change(scope.getByLabelText(/Nom d'utilisateur/i), { target: { value: 'romaric' } });
    fireEvent.change(scope.getByRole('combobox', { name: /Nationalité/i }), { target: { value: 'FR' } });

    fireEvent.click(scope.getByRole('button', { name: /Compléter le profil/i }));

    await waitFor(() => {
      expect(screen.getByText(/Code pays ISO2 invalide/i)).toBeInTheDocument();
    });
  });
});
