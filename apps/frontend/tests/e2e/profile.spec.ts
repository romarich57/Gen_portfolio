import { test, expect } from '@playwright/test';

const csrfResponse = {
  csrfToken: 'csrf-test-token'
};

test('shows inline field errors on onboarding validation', async ({ page }) => {
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
            email: 'test@example.com',
            first_name: null,
            last_name: null,
            username: null,
            nationality: null,
            locale: null,
            roles: ['user'],
            avatar_url: null,
            onboarding_completed_at: null,
            deleted_at: null
          }
        })
      });
      return;
    }
    await route.fulfill({ status: 500, body: '' });
  });

  await page.route('**/me/onboarding', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          completed: false,
          missing_fields: ['first_name', 'last_name', 'username', 'nationality'],
          onboarding_completed_at: null
        })
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'VALIDATION_ERROR',
        fields: ['nationality'],
        issues: [{ field: 'nationality', message: 'country_invalid' }]
      })
    });
  });

  await page.goto('/profile');

  const onboardingSection = page.locator('section', { hasText: 'Onboarding obligatoire' });
  await onboardingSection.getByLabel('Prenom').fill('Romaric');
  await onboardingSection.getByLabel('Nom').fill('Heitz');
  await onboardingSection.getByLabel("Nom d'utilisateur").fill('romaric');
  await onboardingSection.getByLabel(/Nationalite/i).selectOption('FR');

  await onboardingSection.getByRole('button', { name: /Valider l'onboarding/i }).click();

  await expect(onboardingSection.getByText(/Code pays ISO2 invalide/i)).toBeVisible();
});

test('shows CSRF toast on profile update', async ({ page }) => {
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
            email: 'test@example.com',
            first_name: 'Romaric',
            last_name: 'Heitz',
            username: 'romaric',
            nationality: 'FR',
            locale: 'fr-FR',
            roles: ['user'],
            avatar_url: null,
            onboarding_completed_at: new Date().toISOString(),
            deleted_at: null
          }
        })
      });
      return;
    }

    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'CSRF_TOKEN_INVALID' })
    });
  });

  await page.route('**/me/onboarding', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        completed: true,
        missing_fields: [],
        onboarding_completed_at: new Date().toISOString()
      })
    });
  });

  await page.goto('/profile');

  const infoSection = page.locator('section', { hasText: 'Informations' });
  await infoSection.getByLabel('Prenom').fill('Romaric');
  await infoSection.getByRole('button', { name: /Sauvegarder/i }).click();

  await expect(page.getByText(/Session CSRF expiree/i)).toBeVisible();
});
