import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
<<<<<<< HEAD
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
    // Increase timeouts for Vue app initialization
    actionTimeout: 15000,
    navigationTimeout: 30000
  },

  // Set global test timeout
  timeout: 60000,
  expect: {
    // Increase expect timeout for dynamic content
    timeout: 10000
=======
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry'
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
  },

  projects: [
    {
      name: 'chromium',
<<<<<<< HEAD
      use: { 
        ...devices['Desktop Chrome'],
        // Use system Chrome instead of downloading
        channel: 'chrome'
=======
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: true
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
      }
    }
  ],

  webServer: {
<<<<<<< HEAD
    command: 'python3 -m http.server 8000 --directory dist',
    port: 8000,
=======
    command: 'npm run serve',
    port: 4174,
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
    reuseExistingServer: true
  }
})
