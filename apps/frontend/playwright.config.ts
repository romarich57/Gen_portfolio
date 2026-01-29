import { defineConfig } from '@playwright/test';

const useNginx = process.env.PLAYWRIGHT_USE_NGINX === 'true';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? (useNginx ? 'https://localhost:3000' : 'http://localhost:5173');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure'
  },
  webServer: useNginx
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true
      }
});
