import { defineConfig } from '../frontend/node_modules/@playwright/test/index.mjs';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.ADMIN_PLAYWRIGHT_BASE_URL || 'http://localhost:4174',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.ADMIN_PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4174 --strictPort',
        url: 'http://localhost:4174',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});

