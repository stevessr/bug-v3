import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'
import net from 'node:net'

// find a free ephemeral port
async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, () => {
      // @ts-ignore - address can be string | AddressInfo
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 5173
      srv.close(() => resolve(port))
    })
  })
}

const port = process.env.PLAYWRIGHT_PORT ? Number(process.env.PLAYWRIGHT_PORT) : await getFreePort()
const baseURL = process.env.CI ? 'http://localhost:4173' : `http://localhost:${port}`

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
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'edge',
      use: { channel: 'msedge' },
    },
  ],

  webServer: {
    // use the dynamically selected port
    command: `pnpm build && pnpm preview --port ${port}`,
    port,
    // allow reusing an existing preview server during development runs
    reuseExistingServer: true,
  },
})
