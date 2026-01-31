/* eslint-env node */
var _a;
import { defineConfig } from '@playwright/test';
var baseURL = (_a = process.env.PLAYWRIGHT_BASE_URL) !== null && _a !== void 0 ? _a : (process.env.PLAYWRIGHT_USE_NGINX ? 'https://localhost:3002' : 'http://localhost:5174');
export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    use: {
        baseURL: baseURL,
        ignoreHTTPSErrors: true
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } }
    ]
});
