import { test, expect } from '@playwright/test';

const csrfResponse = {
  csrfToken: 'csrf-test-token'
};

test('redirects to MFA setup when required', async ({ page }) => {
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
        body: JSON.stringify({
          profile: {
            id: 'user-1',
            email: 'mfa-required@example.com',
            first_name: 'Mfa',
            last_name: 'Required',
            username: 'mfa_required',
            nationality: 'FR',
            locale: 'fr-FR',
            roles: ['user'],
            avatar_url: null,
            onboarding_completed_at: new Date().toISOString(),
            deleted_at: null,
            mfa_enabled: false,
            mfa_required: true
          }
        })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/auth/mfa/setup/start', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          otpauthUrl: 'otpauth://totp/SaaS%20Builder:mfa-required@example.com?secret=ABC123&issuer=SaaS%20Builder'
        })
      });
      return;
    }
    await route.fulfill({ status: 405, body: '' });
  });

  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/setup-mfa$/);
  await expect(page.getByRole('heading', { name: /Configurer la MFA/i })).toBeVisible();
});
