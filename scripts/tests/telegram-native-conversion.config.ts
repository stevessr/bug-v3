import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'telegram-native-conversion.spec.ts',
  use: { browserName: 'chromium' },
  reporter: 'list',
  webServer: {
    command: 'pnpm serve --host localhost --port 4189',
    url: 'http://localhost:4189',
    reuseExistingServer: !process.env.CI
  }
})
