import { test, expect, type BrowserContext, type APIRequestContext } from '@playwright/test';

const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? 'https://localhost:4000';
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? 'superadmin@saas.local';
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'AdminStrongPassw0rd!';

function parseSetCookies(headers: { name: string; value: string }[], url: string) {
  return headers
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const parts = header.value.split(';').map((part) => part.trim());
      const [nameValue, ...attrs] = parts;
      const [name, value] = nameValue.split('=');
      const cookie: {
        name: string;
        value: string;
        url: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'Lax' | 'Strict' | 'None';
      } = { name, value, url };
      attrs.forEach((attr) => {
        const lower = attr.toLowerCase();
        if (lower === 'httponly') cookie.httpOnly = true;
        if (lower === 'secure') cookie.secure = true;
        if (lower.startsWith('samesite=')) {
          const sameSite = attr.split('=')[1];
          if (sameSite === 'Lax' || sameSite === 'Strict' || sameSite === 'None') {
            cookie.sameSite = sameSite;
          }
        }
      });
      return cookie;
    });
}

async function loginAsAdmin(baseURL: string, request: APIRequestContext, context: BrowserContext) {
  const api = await request.newContext({ baseURL: BACKEND_URL, ignoreHTTPSErrors: true });
  const csrfRes = await api.get('/auth/csrf', {
    headers: { Origin: baseURL, Referer: `${baseURL}/login` }
  });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };

  const loginRes = await api.post('/auth/login', {
    data: { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: {
      Origin: baseURL,
      Referer: `${baseURL}/login`,
      'X-CSRF-Token': csrfToken ?? ''
    }
  });

  const cookies = parseSetCookies(loginRes.headersArray(), BACKEND_URL);
  await context.addCookies(cookies);
  await api.dispose();
}

test('Access denied when not admin', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Acces admin requis/i)).toBeVisible();
});

test('Admin can open dashboard and reveal email', async ({ page, request }) => {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ??
    (process.env.PLAYWRIGHT_USE_NGINX ? 'https://localhost:3002' : 'http://localhost:5174');
  await loginAsAdmin(String(baseURL), request, page.context());

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Vue d/i })).toBeVisible();

  await page.getByRole('link', { name: /Utilisateurs/i }).click();
  await expect(page.getByRole('heading', { name: /Utilisateurs/i })).toBeVisible();

  await page.getByRole('link', { name: /freeuser|premiumuser|vipuser/i }).first().click();
  await expect(page.getByText(/Profil/i)).toBeVisible();

  await page.getByRole('button', { name: /Afficher email complet/i }).click();
  await page.getByPlaceholder('AFFICHER').fill('AFFICHER');
  await page.getByRole('button', { name: /Confirmer/i }).click();

  await expect(page.getByText(/@saas\.local/i)).toBeVisible();
});
