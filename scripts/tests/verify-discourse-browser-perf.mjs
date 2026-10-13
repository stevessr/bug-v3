// Verification runner:
// 1. Bundles memo-check.entry.ts and executes it in real Chromium.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { build } = require('../../node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild')
import { chromium } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '../..')
const dist = join(repo, 'dist')
const results = { memo: null, smoke: [], errors: [] }

// ── 1. memo check ──────────────────────────────────────────────────────────
const outfile = join(mkdtempSync(join(tmpdir(), 'memo-')), 'memo-check.js')
await build({
  entryPoints: [join(import.meta.dirname, 'memo-check.entry.ts')],
  bundle: true,
  format: 'iife',
  outfile,
  platform: 'browser',
  define: {
    __ENABLE_LOGGING__: 'false',
    __ENABLE_FORUM_BROWSER__: 'true',
    __ENABLE_LOCAL_MCP_BRIDGE__: 'false'
  }
})

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('about:blank')
await page.addScriptTag({ path: outfile })
results.memo = await page.evaluate(() => window.__memoCheck())
await page.close()

// ── 2. extension smoke: options page shell mounts ─────────────────────────
const userDataDir = mkdtempSync(join(tmpdir(), 'ext-profile-'))
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: '/usr/bin/chromium',
  headless: false,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-first-run']
})
let worker = context.serviceWorkers()[0]
if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 })
const extensionId = new URL(worker.url()).host

const optPage = await context.newPage()
optPage.on('pageerror', e => results.errors.push(`pageerror: ${e.message}`))
optPage.on('console', m => {
  if (m.type() === 'error') results.errors.push(`console: ${m.text()}`)
})
await optPage.goto(`chrome-extension://${extensionId}/index.html#/discourse-browser`, {
  waitUntil: 'load'
})
await optPage.waitForTimeout(2500)
results.smoke.push(
  `title=${await optPage.title()}`,
  `bodyChars=${await optPage.evaluate(() => document.body.innerText.length)}`,
  `url=${optPage.url()}`
)
await context.close()
await browser.close()

console.log(JSON.stringify(results, null, 2))
const memo = results.memo
const failed = Object.entries(memo || {}).filter(([, v]) => v !== true)
if (failed.length) {
  console.error('MEMO CHECK FAILED:', failed.map(([k]) => k).join(', '))
  process.exit(1)
}
console.log('ALL CHECKS PASSED')
