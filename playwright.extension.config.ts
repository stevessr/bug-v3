import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/tests/extension',
  fullyParallel: false, // Chrome extensions need to be tested sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Only one worker for extension tests
  reporter: 'html',
  use: { trace: 'on-first-retry' }
})
