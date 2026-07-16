import assert from 'node:assert/strict'
import test from 'node:test'

import { collectStaticGraph, formatBytes } from './audit-extension.js'

test('collectStaticGraph follows static imports but not dynamic imports', () => {
  const manifest = {
    entry: { file: 'entry.js', imports: ['shared'], dynamicImports: ['lazy'] },
    shared: { file: 'shared.js', imports: ['runtime'] },
    runtime: { file: 'runtime.js' },
    lazy: { file: 'lazy.js', imports: ['large-vendor'] },
    'large-vendor': { file: 'large-vendor.js' }
  }

  assert.deepEqual([...collectStaticGraph(manifest, ['entry'])].sort(), [
    'entry',
    'runtime',
    'shared'
  ])
})

test('collectStaticGraph deduplicates shared dependencies across surface roots', () => {
  const manifest = {
    html: { file: 'bootstrap.js', imports: ['runtime'] },
    surface: { file: 'surface.js', imports: ['runtime'] },
    runtime: { file: 'runtime.js' }
  }

  assert.deepEqual([...collectStaticGraph(manifest, ['html', 'surface'])].sort(), [
    'html',
    'runtime',
    'surface'
  ])
})

test('formatBytes produces stable human-readable output', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(2048), '2.0 KiB')
  assert.equal(formatBytes(2 * 1024 * 1024), '2.00 MiB')
})
