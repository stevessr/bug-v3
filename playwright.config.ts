import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ? Number(process.env.PLAYWRIGHT_PORT) : 4175
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Force a single worker so the dynamic port is selected once and used
  // consistently by the webServer. This avoids multiple worker processes
  // each choosing a different free port which would cause connection refusals.
  workers: 1,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL,
    trace: 'on-first-retry',
    headless: !!process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=D:/ssh/learn/extension/bug-copilot/dist`,
            `--load-extension=D:/ssh/learn/extension/bug-copilot/dist`,
          ],
        },
      },
    },
    {
      name: 'edge',
      use: {
        channel: 'msedge',
        launchOptions: {
          args: [
            `--disable-extensions-except=D:/ssh/learn/extension/bug-copilot/dist`,
            `--load-extension=D:/ssh/learn/extension/bug-copilot/dist`,
          ],
        },
      },
    },
  ],

  webServer: {
    // use the dynamically selected port to serve built files
    command: `pnpm preview --port ${port} --host 127.0.0.1`,
    // allow reusing an existing preview server during development runs
    reuseExistingServer: !process.env.CI,
    url: baseURL,
    timeout: 30 * 1000,
  },
})
