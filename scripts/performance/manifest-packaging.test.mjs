import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createFirefoxManifest } from '../firefox-manifest.js'
import { createXPI } from '../pack-xpi.js'

const source = JSON.parse(
  await fs.readFile(new URL('../../public/manifest.json', import.meta.url), 'utf8')
)
test('Chromium MV3 manifest has no Firefox keys or invalid optional debugger permission', () => {
  assert.equal(source.manifest_version, 3)
  assert.equal(source.background.service_worker, 'js/background.js')
  assert.equal(source.background.type, 'module')
  assert.ok(!('scripts' in source.background))
  assert.ok(!('sidebar_action' in source))
  assert.ok(!('browser_specific_settings' in source))
  assert.ok(source.side_panel)
  assert.ok(source.permissions.includes('debugger'))
  assert.ok(!source.optional_permissions.includes('debugger'))
})
test('Firefox transformation removes Chromium permissions from both lists without mutating its input', () => {
  const input = structuredClone(source)
  input.optional_permissions.push('debugger', 'sidePanel')
  const before = structuredClone(input)
  const result = createFirefoxManifest(input)
  assert.deepEqual(input, before)
  assert.deepEqual(result.background, { scripts: ['js/background.js'], type: 'module' })
  assert.ok(result.sidebar_action)
  assert.ok(!result.side_panel)
  assert.ok(!result.permissions.includes('debugger'))
  assert.deepEqual(result.optional_permissions, ['cookies'])
  assert.equal(result.browser_specific_settings.gecko.id, 'emoji-extension@pwsh.us.kg')
})
test('XPI contains Firefox manifest while dist and subsequent Chromium packaging stay unchanged', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'emoji-xpi-test-'))
  try {
    const distPath = path.join(dir, 'dist')
    const outputPath = path.join(dir, 'test.xpi')
    await fs.mkdir(path.join(distPath, 'js'), { recursive: true })
    const original = JSON.stringify(source, null, 2)
    await fs.writeFile(path.join(distPath, 'manifest.json'), original)
    await fs.writeFile(path.join(distPath, 'js/background.js'), 'export {};')
    await createXPI({ distPath, outputPath })
    assert.equal(await fs.readFile(path.join(distPath, 'manifest.json'), 'utf8'), original)
    const archived = JSON.parse(
      execFileSync('unzip', ['-p', outputPath, 'manifest.json'], { encoding: 'utf8' })
    )
    assert.deepEqual(archived, createFirefoxManifest(source))
    assert.equal(
      execFileSync('unzip', ['-p', outputPath, 'js/background.js'], { encoding: 'utf8' }),
      'export {};'
    )
    const entries = execFileSync('unzip', ['-Z1', outputPath], { encoding: 'utf8' })
      .trim()
      .split('\n')
    assert.equal(entries.filter(entry => entry === 'manifest.json').length, 1)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
