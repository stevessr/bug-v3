import assert from 'node:assert/strict'
import test from 'node:test'

import { getMessage, setLanguage } from '../../src/utils/i18n.ts'

test('concurrent locale initialization shares one fetch', async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0
  globalThis.fetch = async () => {
    fetchCount += 1
    await Promise.resolve()
    return {
      json: async () => ({ performanceGreeting: { message: 'ready' } })
    }
  }

  try {
    await Promise.all([setLanguage('performance-test'), setLanguage('performance-test')])
    assert.equal(fetchCount, 1)
    assert.equal(getMessage('performanceGreeting'), 'ready')
  } finally {
    globalThis.fetch = originalFetch
  }
})
