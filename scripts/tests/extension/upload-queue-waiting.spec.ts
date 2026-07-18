import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'

const testAssetDirectory = path.resolve('dist/upload-queue-test-assets')
const testAssetName = 'upload-queue.iife.js'

async function loadUploadQueue(page: Page): Promise<void> {
  await page.goto('/')
  await page.setContent('<meta name="csrf-token" content="test-token">')
  const source = await fs.readFile(path.join(testAssetDirectory, testAssetName), 'utf8')
  await page.addScriptTag({ content: `${source}\nwindow.UploadQueueTest = UploadQueueTest;` })
}

test.describe('injected upload waiting queue', () => {
  test.beforeAll(async () => {
    await fs.rm(testAssetDirectory, { recursive: true, force: true })
    await build({
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      resolve: {
        alias: {
          '@': path.resolve('src')
        }
      },
      build: {
        target: 'es2020',
        minify: false,
        sourcemap: false,
        emptyOutDir: true,
        outDir: testAssetDirectory,
        lib: {
          entry: path.resolve('src/content/utils/upload/core.ts'),
          name: 'UploadQueueTest',
          formats: ['iife'],
          fileName: () => testAssetName
        }
      }
    })
  })

  test('a Discourse rate limit pauses the whole batch instead of probing later files', async ({
    page
  }) => {
    await loadUploadQueue(page)

    const result = await page.evaluate(async () => {
      const calls: { name: string; at: number }[] = []
      const channel = 'emoji-extension:discourse-native-upload:v1'

      Object.defineProperty(window, 'chrome', {
        configurable: true,
        value: { runtime: { getURL: () => '/mock-discourse-native-upload.js' } }
      })

      // The production loader only needs the script's load signal here; this
      // message listener acts as the Discourse MAIN-world bridge.
      const originalAppendChild = document.head.appendChild.bind(document.head)
      document.head.appendChild = (<T extends Node>(node: T): T => {
        if (node instanceof HTMLScriptElement && node.dataset.emojiExtensionBridge) {
          queueMicrotask(() => node.dispatchEvent(new Event('load')))
          return node
        }
        return originalAppendChild(node) as T
      }) as typeof document.head.appendChild

      window.addEventListener('message', event => {
        const request = event.data
        if (
          event.source !== window ||
          request?.channel !== channel ||
          request?.direction !== 'request'
        ) {
          return
        }

        const file = request.file as File
        calls.push({ name: file.name, at: performance.now() })
        const responseBase = {
          channel,
          direction: 'response',
          id: request.id
        }

        if (file.name === 'a.png') {
          window.postMessage(
            {
              ...responseBase,
              status: 'error',
              error: {
                message: 'rate limited by Discourse',
                status: 429,
                errorType: 'rate_limit',
                waitSeconds: 0.05
              }
            },
            window.location.origin
          )
          return
        }

        window.postMessage(
          {
            ...responseBase,
            status: 'uploaded',
            upload: {
              id: calls.length,
              url: `/uploads/${file.name}`,
              short_url: `upload://${file.name}`,
              original_filename: file.name
            }
          },
          window.location.origin
        )
      })

      window.fetch = (() => {
        throw new Error('Native Discourse uploads must not fall back to fetch')
      }) as typeof window.fetch

      const uploader = new (window as any).UploadQueueTest.ImageUploader()
      const statusLog: Record<string, { status: string; waitSeconds?: number }[]> = {}
      const files = ['a.png', 'b.png', 'c.png'].map(
        name => new File([name], name, { type: 'image/png' })
      )

      const outcomes = await Promise.allSettled(
        files.map(file =>
          uploader.uploadImage(file, 'composer', (update: any) => {
            ;(statusLog[file.name] ||= []).push({
              status: update.status,
              waitSeconds: update.waitSeconds
            })
          })
        )
      )

      return { calls, statusLog, outcomes: outcomes.map(outcome => outcome.status) }
    })

    expect(result.calls.map(call => call.name)).toEqual([
      'a.png',
      'a.png',
      'a.png',
      'b.png',
      'c.png'
    ])
    expect(result.calls[1].at - result.calls[0].at).toBeGreaterThanOrEqual(45)
    expect(result.calls[2].at - result.calls[1].at).toBeGreaterThanOrEqual(45)
    // Retry exhaustion must retain one final cooldown before the next file.
    expect(result.calls[3].at - result.calls[2].at).toBeGreaterThanOrEqual(45)
    expect(result.outcomes).toEqual(['rejected', 'fulfilled', 'fulfilled'])

    expect(result.statusLog['a.png'].map(item => item.status)).toEqual(
      expect.arrayContaining(['waiting', 'uploading', 'failed'])
    )
    expect(
      result.statusLog['a.png'].some(
        item => item.status === 'waiting' && (item.waitSeconds ?? 0) > 0
      )
    ).toBe(true)
    expect(
      result.statusLog['b.png'].some(
        item => item.status === 'waiting' && (item.waitSeconds ?? 0) > 0
      )
    ).toBe(true)
  })

  test('the backend preference can bypass the native composer uploader for the built-in API', async ({
    page
  }) => {
    await loadUploadQueue(page)

    const result = await page.evaluate(async () => {
      const channel = 'emoji-extension:discourse-native-upload:v1'
      let nativeLoaderCalls = 0
      let nativeUploadRequests = 0
      const fetchCalls: Array<{
        url: string
        method: string
        uploadType: FormDataEntryValue | null
        fileName: string | null
      }> = []

      Object.defineProperty(window, 'chrome', {
        configurable: true,
        value: {
          runtime: {
            getURL: () => {
              nativeLoaderCalls++
              return '/mock-discourse-native-upload.js'
            }
          }
        }
      })

      const originalAppendChild = document.head.appendChild.bind(document.head)
      document.head.appendChild = (<T extends Node>(node: T): T => {
        if (node instanceof HTMLScriptElement && node.dataset.emojiExtensionBridge) {
          queueMicrotask(() => node.dispatchEvent(new Event('load')))
          return node
        }
        return originalAppendChild(node) as T
      }) as typeof document.head.appendChild

      // If the disabled native route is accidentally invoked, answer quickly so
      // the regression fails on call counts instead of timing out.
      window.addEventListener('message', event => {
        const request = event.data
        if (
          event.source !== window ||
          request?.channel !== channel ||
          request?.direction !== 'request'
        ) {
          return
        }
        nativeUploadRequests++
        window.postMessage(
          {
            channel,
            direction: 'response',
            id: request.id,
            status: 'unavailable',
            reason: 'mock native uploader disabled'
          },
          window.location.origin
        )
      })

      window.fetch = (async (input, init) => {
        const body = init?.body as FormData
        const file = body.get('file')
        fetchCalls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          uploadType: body.get('upload_type'),
          fileName: file instanceof File ? file.name : null
        })
        return new Response(
          JSON.stringify({
            id: 41,
            url: '/uploads/default/original/api.png',
            short_url: 'upload://api-result',
            original_filename: 'api.png',
            width: 320,
            height: 200
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }) as typeof window.fetch

      const uploader = new (window as any).UploadQueueTest.ImageUploader(() => false)
      const upload = await uploader.uploadImage(
        new File(['api-image'], 'api.png', { type: 'image/png' }),
        'composer'
      )

      return {
        nativeLoaderCalls,
        nativeUploadRequests,
        fetchCalls,
        upload: {
          id: upload.id,
          url: upload.url,
          shortUrl: upload.short_url
        }
      }
    })

    expect(result.nativeLoaderCalls).toBe(0)
    expect(result.nativeUploadRequests).toBe(0)
    expect(result.fetchCalls).toHaveLength(1)
    expect(result.fetchCalls[0]).toMatchObject({
      method: 'POST',
      uploadType: 'composer',
      fileName: 'api.png'
    })
    expect(result.fetchCalls[0].url).toContain('/uploads.json?client_id=')
    expect(result.upload).toEqual({
      id: 41,
      url: `${new URL(page.url()).origin}/uploads/default/original/api.png`,
      shortUrl: 'upload://api-result'
    })
  })
})
