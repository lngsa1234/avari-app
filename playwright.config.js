const { defineConfig } = require('@playwright/test')

const baseURL = process.env.E2E_BASE_URL || 'https://www.circlew.app'

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  // Only start local dev server if testing locally
  ...(baseURL.includes('localhost') ? {
    webServer: {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 60000,
    },
  } : {}),
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
