import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Billing from './Billing';
import QueryProvider from '@/app/providers/QueryProvider';

const mockGetBillingStatus = vi.fn();
const mockChangePlan = vi.fn();
const mockCreatePortalSession = vi.fn();

vi.mock('@/api/billing', () => ({
  getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
  changePlan: (...args: unknown[]) => mockChangePlan(...args),
  createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args)
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
  useAuth: () => ({
    csrfToken: 'csrf-token'
  })
}));

function renderBilling() {
  return render(
    <QueryProvider>
      <Billing />
    </QueryProvider>
  );
}

describe('Billing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBillingStatus.mockResolvedValue({
      plan_code: 'VIP',
      status: 'active',
      period_start: null,
      period_end: null,
      cancel_at_period_end: false,
      entitlements: {
        projects_limit: null,
        projects_used: 0,
        period_start: null,
        period_end: null
      },
      roles: ['user', 'vip']
    });
    mockCreatePortalSession.mockResolvedValue({ portal_url: 'https://billing.stripe.com/p/session_123' });
  });

  it('downgrades immediately without end-of-period scheduling flow', async () => {
    mockChangePlan.mockResolvedValue({
      changeType: 'downgrade',
      message: 'Downgrade immédiat appliqué',
      effectiveAt: null
    });

    renderBilling();

    const downgradeButton = await screen.findByRole('button', { name: /Basculer vers ELITE/i });
    fireEvent.click(downgradeButton);

    await waitFor(() => {
      expect(mockChangePlan).toHaveBeenCalledWith({ planCode: 'PREMIUM' });
    });

    expect(await screen.findByText(/Downgrade immédiat appliqué/i)).toBeInTheDocument();
  });

  it('blocks redirect when portal URL is invalid', async () => {
    mockCreatePortalSession.mockResolvedValueOnce({ portal_url: 'https://evil.example.com/portal' });

    renderBilling();

    const portalButton = await screen.findByRole('button', { name: /Gerer dans Stripe/i });
    fireEvent.click(portalButton);

    await waitFor(() => {
      expect(mockCreatePortalSession).toHaveBeenCalled();
    });

    expect(await screen.findByText(/URL de redirection Stripe invalide/i)).toBeInTheDocument();
  });

  it('blocks redirect when checkout URL is invalid', async () => {
    mockGetBillingStatus.mockResolvedValueOnce({
      plan_code: 'FREE',
      status: 'active',
      period_start: null,
      period_end: null,
      cancel_at_period_end: false,
      entitlements: {
        projects_limit: 1,
        projects_used: 0,
        period_start: null,
        period_end: null
      },
      roles: ['user']
    });
    mockChangePlan.mockResolvedValueOnce({
      changeType: 'upgrade',
      message: 'Upgrade pending',
      checkoutUrl: 'https://evil.example.com/checkout'
    });

    renderBilling();

    const upgradeButton = await screen.findByRole('button', { name: /Passer à ELITE/i });
    fireEvent.click(upgradeButton);

    await waitFor(() => {
      expect(mockChangePlan).toHaveBeenCalledWith({ planCode: 'PREMIUM' });
    });

    expect(await screen.findByText(/URL de redirection Stripe invalide/i)).toBeInTheDocument();
  });
});
