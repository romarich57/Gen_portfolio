import { test, expect } from '@playwright/test';

const csrfResponse = { csrfToken: 'csrf-test-token' };

const profile = {
  id: 'user-1',
  email: 'billing@example.com',
  first_name: 'Romaric',
  last_name: 'Heitz',
  username: 'romaric',
  nationality: 'FR',
  locale: 'fr-FR',
  roles: ['user'],
  avatar_url: null,
  mfa_enabled: false,
  mfa_required: false,
  onboarding_completed_at: new Date().toISOString(),
  deleted_at: null,
  connected_accounts: []
};

test('upgrade immediate + downgrade scheduled shows badge and effective date', async ({ page }) => {
  await page.route('**/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(csrfResponse)
    });
  });

  await page.route('**/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile })
      });
      return;
    }
    await route.fulfill({ status: 200, body: '{}' });
  });

  let statusIndex = 0;
  const statusResponses = [
    {
      plan_code: 'FREE',
      scheduled_plan_code: null,
      status: 'active',
      period_start: null,
      period_end: null,
      cancel_at_period_end: false,
      entitlements: { projects_limit: 1, projects_used: 0, period_start: null, period_end: null },
      roles: ['user']
    },
    {
      plan_code: 'PREMIUM',
      scheduled_plan_code: null,
      status: 'active',
      period_start: '2026-02-01T00:00:00.000Z',
      period_end: '2026-03-01T00:00:00.000Z',
      cancel_at_period_end: false,
      entitlements: {
        projects_limit: 5,
        projects_used: 0,
        period_start: '2026-02-01T00:00:00.000Z',
        period_end: '2026-03-01T00:00:00.000Z'
      },
      roles: ['premium']
    },
    {
      plan_code: 'PREMIUM',
      scheduled_plan_code: 'FREE',
      status: 'active',
      period_start: '2026-02-01T00:00:00.000Z',
      period_end: '2026-03-01T00:00:00.000Z',
      cancel_at_period_end: true,
      entitlements: {
        projects_limit: 5,
        projects_used: 0,
        period_start: '2026-02-01T00:00:00.000Z',
        period_end: '2026-03-01T00:00:00.000Z'
      },
      roles: ['premium']
    }
  ];

  await page.route('**/billing/status', async (route) => {
    const payload = statusResponses[Math.min(statusIndex, statusResponses.length - 1)];
    statusIndex += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  });

  await page.route('**/billing/change-plan', async (route) => {
    const body = (await route.request().postDataJSON().catch(() => ({}))) as { planCode?: string };
    if (body.planCode === 'PREMIUM') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          changeType: 'upgrade',
          effectiveAt: '2026-02-10T00:00:00.000Z',
          message: 'Plan mis à jour immédiatement.'
        })
      });
      return;
    }
    if (body.planCode === 'FREE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          changeType: 'downgrade',
          effectiveAt: '2026-03-10T00:00:00.000Z',
          message: 'Plan sera rétrogradé à la fin de la période.'
        })
      });
      return;
    }
    await route.fulfill({ status: 400, body: '{}' });
  });

  await page.goto('/billing');

  await page.getByRole('button', { name: /Passer à ELITE/i }).click();
  await expect(page.getByText(/Changement appliqué le 10\/02\/2026/i)).toBeVisible();

  await page.getByRole('button', { name: /Revenir au plan gratuit/i }).click();
  await page.getByRole('button', { name: /Confirmer/i }).click();

  await expect(page.getByText(/Changement appliqué le 10\/03\/2026/i)).toBeVisible();
  await expect(page.getByText(/Change bientôt en FREE/i)).toBeVisible();
});
