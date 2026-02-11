const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: true,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:8000/api/projects',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
