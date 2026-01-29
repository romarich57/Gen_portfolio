import { test, expect } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const expectMfaGate = process.env.E2E_EXPECT_MFA_REQUIRED === 'true';

test.skip(!email || !password || !expectMfaGate, 'Missing E2E credentials or E2E_EXPECT_MFA_REQUIRED=true');

test('real flow: MFA required gate redirects to setup', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel(/Email ou pseudo/i).fill(email!);
  await page.getByLabel(/Mot de passe/i).fill(password!);

  await page.getByRole('button', { name: /Se connecter/i }).click();

  await expect(page).toHaveURL(/\/setup-mfa$/);
  await expect(page.getByRole('heading', { name: /Configurer la MFA/i })).toBeVisible();
});
