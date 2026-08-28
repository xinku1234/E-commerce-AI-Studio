import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3230',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3230/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: { PORT: '3230', REQUIRE_MODEL: 'false', DISABLE_HMR: 'true' }
  }
});
