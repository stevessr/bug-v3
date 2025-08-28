import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'

// We will load the module under test after setting up global mocks

describe('content-script session sync', () => {
  let originalChrome: any

  beforeEach(() => {
    // ensure a clean sessionStorage/localStorage
    window.sessionStorage.clear()
    window.localStorage.clear()

    // mock chrome object
    originalChrome = (global as any).chrome
    ;(global as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: any, cb: any) => cb({ session_payload: { foo: 'bar' } })),
        },
      },
      runtime: {
        sendMessage: vi.fn((msg: any, cb?: any) => cb && cb({ ok: true })),
        onMessage: { addListener: vi.fn() },
      },
    }
  })

  afterEach(() => {
    // restore
    ;(global as any).chrome = originalChrome
    window.sessionStorage.clear()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('applies session_payload from chrome.storage.local into sessionStorage on load', async () => {
    // import the module (side-effects run)
    await import('../content-script/content-script')
    const v = window.sessionStorage.getItem('bugcopilot_settings_v1')
    expect(v).toBeTruthy()
    if (v) expect(JSON.parse(v)).toEqual({ foo: 'bar' })

    // ensure ack message was sent at least once
    expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalled()
  })
})
