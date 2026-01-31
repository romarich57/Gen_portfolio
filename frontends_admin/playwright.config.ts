import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? (process.env.PLAYWRIGHT_USE_NGINX ? 'https://localhost:3002' : 'http://localhost:5174');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL,
    ignoreHTTPSErrors: true
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
});
