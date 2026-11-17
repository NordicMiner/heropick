import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173/heropick/' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --port 4173 --strictPort',
    url: 'http://localhost:4173/heropick/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'webkit', use: { ...devices['iPhone 13'] }, testIgnore: /offline\.spec/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testMatch: /offline\.spec/ },
  ],
});
