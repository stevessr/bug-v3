// Repro: load dist extension, seed ungrouped emojis (linux.do CDN urls) + VALID
// appSettings with force-indexeddb (proxy/cache path), inspect whether images render.
import { chromium } from 'playwright'
import path from 'path'

const EXTENSION_PATH = path.resolve('./dist')

// Valid AppSettings (mirrors defaultSettings) with force-indexeddb cache strategy.
const settings = {
  imageScale: 100,
  defaultGroup: 'nachoneko',
  showSearchBar: true,
  gridColumns: 4,
  outputFormat: 'markdown',
  forceMobileMode: false,
  enableHoverPreview: true,
  enableXcomExtraSelectors: false,
  enableCalloutSuggestions: true,
  enableColorSuggestions: true,
  enableBatchParseImages: false,
  enableExperimentalFeatures: false,
  enableChatMultiReactor: false,
  chatMultiReactorEmojis: [],
  geminiApiUrl: '',
  geminiLanguage: 'Chinese',
  md3ColorScheme: 'default',
  md3SeedColor: '#1890ff',
  syncVariantToDisplayUrl: true,
  imageCacheStrategy: 'force-indexeddb', // <-- force proxy/cache path
  cloudMarketDomain: 's.pwsh.us.kg',
  enableLinuxDoSeeking: false,
  linuxDoSeekingUsers: [],
  enableLinuxDoSeekingDanmaku: false,
  enableLinuxDoSeekingSysNotify: false,
  enableLinuxDoSeekingNtfy: false,
  linuxDoSeekingNtfyTopic: '',
  linuxDoSeekingNtfyServer: 'https://ntfy.sh',
  linuxDoSeekingRefreshIntervalMs: 60000,
  linuxDoSeekingPosition: 'left',
  linuxDoSeekingActionFilter: '1,5',
  telegramWebmToAvifEnabled: false,
  enableDiscourseRouterRefresh: false,
  discourseRouterRefreshInterval: 30000,
  useDiscourseNativeUpload: true,
  forumUploadConcurrency: 3,
  enableLinuxDoCredit: false
}

async function main() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-features=VizDisplayCompositor',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  })

  let [bg] = context.serviceWorkers()
  if (!bg) bg = await context.waitForEvent('serviceworker', { timeout: 20000 })
  const extensionId = new URL(bg.url()).host
  console.log('extension id:', extensionId)

  const page = await context.newPage()
  const errs = []
  const logs = []
  page.on('console', m => {
    if (m.type() === 'error') errs.push(m.text())
    else logs.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="gold"/></svg>'
  const group = {
    id: 'ungrouped',
    name: '未分组',
    order: 999,
    emojis: [
      {
        id: 'e-ldcdn',
        packet: 1758435127372,
        name: 'linux-do-cdn',
        url: 'https://idcflare.com/uploads/default/original/2X/4/49183cb33b04888a45f281a49714d02b805a86dc.png',
        groupId: 'ungrouped',
        tags: []
      },
      {
        id: 'e-data',
        packet: 1,
        name: 'data-svg',
        url: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
        groupId: 'ungrouped',
        tags: []
      }
    ]
  }

  await page.addInitScript(
    v => {
      ;(async () => {
        if (chrome?.storage?.local) await new Promise(r => chrome.storage.local.set({ ...v }, r))
      })()
    },
    {
      emojiGroupIndex: [{ id: group.id, order: group.order }],
      [`emojiGroup_${group.id}`]: group,
      appSettings: settings
    }
  )

  await page.goto(`chrome-extension://${extensionId}/index.html?type=options&tabs=ungrouped`)
  await page.waitForTimeout(12000)

  const st = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.emoji-item')).map(card => {
      const img = card.querySelector('img')
      if (!img) return { name: '(no img)' }
      return {
        name: card.querySelector('.text-xs')?.textContent || '(no name)',
        src: img.getAttribute('src')?.slice(0, 100),
        dataError: img.getAttribute('data-error'),
        dataCached: img.getAttribute('data-cached'),
        naturalWidth: img.naturalWidth,
        complete: img.complete,
        visible: !!(img.offsetWidth || img.offsetHeight || img.getClientRects().length)
      }
    })
    return { items }
  })

  console.log('RESULT:', JSON.stringify(st, null, 2))
  console.log('---ERRORS---')
  errs.forEach(e => console.log('ERR:', e))
  const imgLogs = logs.filter(
    l => l.includes('UngroupedTab') || l.includes('ImageCache') || l.includes('ProxyImage')
  )
  console.log('---IMAGE LOGS---')
  imgLogs.slice(0, 50).forEach(l => console.log(l))

  await page.screenshot({ path: '/tmp/ungrouped-force-indexeddb.png', fullPage: true })
  console.log('screenshot saved')
  await context.close()
}

main().catch(e => {
  console.error('FATAL', e)
  process.exit(1)
})