import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'
import { build } from 'vite'

const testAssetDirectory = path.resolve('dist/test-assets-file-persistence')
const testAssetName = 'file-persistence.iife.js'

test.describe('useFilePersistence incremental IndexedDB sync', () => {
  test.describe.configure({ mode: 'serial' })

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
          entry: path.resolve('src/options/pages/composables/useFilePersistence.ts'),
          name: 'FilePersistenceTest',
          formats: ['iife'],
          fileName: () => testAssetName
        }
      }
    })
  })

  test.afterAll(async () => {
    await fs.rm(testAssetDirectory, { recursive: true, force: true })
  })

  test('only serializes newly added files and deletes removed ones without full rewrite', async ({
    page
  }) => {
    await page.route('http://localhost/persistence-test', route =>
      route.fulfill({ body: '<html></html>', contentType: 'text/html' })
    )
    await page.goto('http://localhost/persistence-test')
    await page.addScriptTag({ path: path.join(testAssetDirectory, testAssetName) })

    const outcome = await page.evaluate(async () => {
      const { useFilePersistence } = (window as any).FilePersistenceTest
      const makeTrackedFile = (id: string, name: string, payload: string) => {
        const file = new File([payload], name, { type: 'image/png' })
        let arrayBufferCalls = 0
        const origArrayBuffer = file.arrayBuffer.bind(file)
        file.arrayBuffer = () => {
          arrayBufferCalls++
          return origArrayBuffer()
        }
        return {
          item: {
            id,
            file,
            previewUrl: `blob:${id}`,
            width: 32,
            height: 32
          },
          getCalls: () => arrayBufferCalls
        }
      }

      const selectedFiles = { value: [] as any[] }
      const persistence = useFilePersistence(selectedFiles)
      await persistence.clearPersistedFiles()

      const f1 = makeTrackedFile('id-1', 'one.png', 'aaa')
      const f2 = makeTrackedFile('id-2', 'two.png', 'bbb')
      selectedFiles.value = [f1.item, f2.item]
      await persistence.saveSelectedFiles()

      const callsAfterInitial = [f1.getCalls(), f2.getCalls()]

      // Add a third file: existing f1 and f2 must NOT re-run arrayBuffer()
      const f3 = makeTrackedFile('id-3', 'three.png', 'ccc')
      selectedFiles.value = [f1.item, f2.item, f3.item]
      await persistence.saveSelectedFiles()

      const callsAfterAppend = [f1.getCalls(), f2.getCalls(), f3.getCalls()]

      // Remove f1: remaining f2 and f3 must NOT re-run arrayBuffer()
      selectedFiles.value = [f2.item, f3.item]
      await persistence.saveSelectedFiles()

      const callsAfterDelete = [f1.getCalls(), f2.getCalls(), f3.getCalls()]

      // Restore in a fresh composable instance
      const restoredFiles = { value: [] as any[] }
      const freshPersistence = useFilePersistence(restoredFiles)
      await freshPersistence.loadSelectedFiles()
      const restoredSummary = restoredFiles.value
        .map(item => ({ id: item.id, name: item.file.name, size: item.file.size }))
        .sort((a, b) => a.id.localeCompare(b.id))

      await freshPersistence.clearPersistedFiles()
      await persistence.flushAndDisposePersistence()

      return {
        callsAfterInitial,
        callsAfterAppend,
        callsAfterDelete,
        restoredSummary
      }
    })

    expect(outcome.callsAfterInitial).toEqual([1, 1])
    expect(outcome.callsAfterAppend).toEqual([1, 1, 1])
    expect(outcome.callsAfterDelete).toEqual([1, 1, 1])
    expect(outcome.restoredSummary).toEqual([
      { id: 'id-2', name: 'two.png', size: 3 },
      { id: 'id-3', name: 'three.png', size: 3 }
    ])
  })
})
