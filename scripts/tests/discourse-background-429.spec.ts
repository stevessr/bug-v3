import { expect, test } from '@playwright/test'

test('reloads the matching Linux DO tab and retries an HTTP 429 request', async () => {
  const scope = globalThis as any
  const previousChrome = scope.chrome
  const previousCreateLogger = scope.createLogger
  const requests: Array<{ tabId: number; type: string }> = []
  let reloadCount = 0
  let fetchCount = 0

  scope.createLogger = () => ({
    debug() {},
    info() {},
    warn() {},
    error() {}
  })
  scope.chrome = {
    storage: {
      onChanged: { addListener() {} }
    },
    tabs: {
      async query(query: { url?: string }) {
        expect(query.url).toBe('*://linux.do/*')
        return [{ id: 17, url: 'https://linux.do/t/test/1', status: 'complete' }]
      },
      async sendMessage(tabId: number, message: { type: string }) {
        requests.push({ tabId, type: message.type })
        fetchCount += 1
        return {
          success: true,
          data: {
            status: fetchCount === 1 ? 429 : 200,
            ok: fetchCount > 1,
            data: fetchCount === 1 ? { error: 'rate limited' } : { topic_list: { topics: [] } }
          }
        }
      },
      async reload(tabId: number, options: { bypassCache?: boolean }) {
        expect(tabId).toBe(17)
        expect(options.bypassCache).toBe(true)
        reloadCount += 1
      },
      async get(tabId: number) {
        expect(tabId).toBe(17)
        return { id: tabId, url: 'https://linux.do/t/test/1', status: 'complete' }
      }
    }
  }

  try {
    const { handlePageFetchRequest } =
      await import('../../src/background/handlers/handlePageFetchRequest')
    let response: any
    await handlePageFetchRequest({ url: 'https://linux.do/latest.json' }, value => {
      response = value
    })

    expect(reloadCount).toBe(1)
    expect(requests).toEqual([
      { tabId: 17, type: 'PAGE_FETCH' },
      { tabId: 17, type: 'PAGE_FETCH' }
    ])
    expect(response?.data?.status).toBe(200)
  } finally {
    if (previousChrome === undefined) delete scope.chrome
    else scope.chrome = previousChrome
    if (previousCreateLogger === undefined) delete scope.createLogger
    else scope.createLogger = previousCreateLogger
  }
})
