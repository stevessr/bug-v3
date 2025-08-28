import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeAll } from 'vitest'

// Polyfill matchMedia for ant-design-vue responsive utilities in jsdom
beforeAll(() => {
  // @ts-ignore
  if (!window.matchMedia) {
    // simple mock
    // @ts-ignore
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }

  // Polyfill FileReader for tests (reads File.arrayBuffer)
  // @ts-ignore
  if (typeof global.FileReader === 'undefined') {
    // @ts-ignore
    global.FileReader = class {
      result: string | null = null
      // 允许接收可选事件/错误参数，兼容调用时传参或不传参
      onload: ((ev?: any) => void) | null = null
      onerror: ((err?: any) => void) | null = null
      readAsDataURL(file: any) {
        file
          .arrayBuffer()
          .then((buf: ArrayBuffer) => {
            const u8 = new Uint8Array(buf)
            // use Buffer to base64
            // @ts-ignore
            const b64 = Buffer.from(u8).toString('base64')
            this.result = `data:${file.type};base64,${b64}`
            this.onload && this.onload()
          })
          .catch((err: any) => {
            this.onerror && this.onerror(err)
          })
      }
    }
  }
})

// Mock OpenRouterService by creating a simple replacement in the component's module
// Mock the actual service module at src/services/openrouter
vi.mock('../../../services/openrouter', () => {
  class MockService {
    apiKeys: string[] = []
    setApiKeys(keys: string[]) {
      this.apiKeys = keys
    }
    async generateText(messages: any[]) {
      return {
        choices: [{ message: { role: 'assistant', content: 'reply', images: [] } }],
      }
    }
    async generateImage(prompt: string) {
      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'image reply',
              images: [{ type: 'image_url', image_url: { url: 'iVBORw0KGgoAAAANSUhEUg' } }],
            },
          },
        ],
      }
    }
    async *streamText(messages: any[]) {
      yield { choices: [{ delta: { content: 'streamed ' } }] }
      yield { choices: [{ delta: { content: 'text' } }] }
      yield {
        choices: [
          {
            delta: {
              content: '',
              images: [{ type: 'image_url', image_url: { url: 'iVBORw0KGgoAAAANSUhEUg' } }],
            },
          },
        ],
      }
      return
    }
    async *streamImage(prompt: string) {
      yield {
        choices: [
          {
            delta: {
              content: '',
              images: [{ type: 'image_url', image_url: { url: 'iVBORw0KGgoAAAANSUhEUg' } }],
            },
          },
        ],
      }
      return
    }
  }
  return { OpenRouterService: MockService }
})

describe('OpenRouterChat', () => {
  it('adds and removes pending image via URL and includes it when sending', async () => {
    // ensure loadApiKeys picks up keys on mount
    localStorage.setItem('openrouter-api-keys', JSON.stringify(['fake-key']))
    const mod = await import('../OpenRouterChat.vue')
    const OpenRouterChat = mod.default
    const wrapper = mount(OpenRouterChat)

    // set API keys so send is enabled
    wrapper.vm.apiKeys.push('fake-key')

    // add image url via method (avoids DOM timing)
    wrapper.vm.imageUrlInput = 'iVBORw0KGgoAAAANSUhEUg'
    wrapper.vm.addImageUrl()

    // pendingImages should have one item
    expect(wrapper.vm.pendingImages.length).toBe(1)

    // send by calling sendMessage directly and await
    wrapper.vm.inputMessage = 'hello'
    await wrapper.vm.sendMessage()

    // messages should include the user message with images
    expect(
      wrapper.vm.messages.some((m: any) => m.role === 'user' && m.images && m.images.length === 1),
    ).toBe(true)
  })

  it('handles file upload and displays pending thumbnail', async () => {
    localStorage.setItem('openrouter-api-keys', JSON.stringify(['fake-key']))
    const mod = await import('../OpenRouterChat.vue')
    const OpenRouterChat = mod.default
    const wrapper = mount(OpenRouterChat)
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    // trigger change with files
    const event = { target: { files: [file] } }
    // @ts-ignore call handler directly
    await wrapper.vm.handleFileUpload(event as any)
    expect(wrapper.vm.pendingImages.length).toBe(1)
    expect(wrapper.vm.pendingImages[0].image_url.url.startsWith('data:image/png;base64,')).toBe(
      true,
    )
  })

  it('receives streamed text and images and displays assistant message', async () => {
    localStorage.setItem('openrouter-api-keys', JSON.stringify(['fake-key']))
    const mod = await import('../OpenRouterChat.vue')
    const OpenRouterChat = mod.default
    const wrapper = mount(OpenRouterChat)
    wrapper.vm.inputMessage = 'stream test'
    // enable streaming and send by calling sendMessage
    wrapper.vm.enableStreaming = true
    await wrapper.vm.sendMessage()

    // wait for stream processing
    await new Promise((r) => setTimeout(r, 200))

    // assistant message should exist with content including 'streamed'
    const assistant = wrapper.vm.messages.find((m: any) => m.role === 'assistant')
    expect(assistant).toBeTruthy()
    expect(assistant?.content.includes('streamed')).toBe(true)
    // and should have images normalized to data URL
    expect(assistant?.images && assistant?.images.length > 0).toBe(true)
    // 安全读取第一个图片 URL，先检查类型再调用 startsWith，避免 TS 报「可能为未定义」
    const firstImageUrl = assistant?.images?.[0]?.image_url?.url
    expect(typeof firstImageUrl === 'string' && firstImageUrl.startsWith('data:')).toBe(true)
  })
})
