import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: true
      }
    }
  ],

  webServer: {
    command: 'npm run serve',
    port: 4174,
    reuseExistingServer: true
  }
})
