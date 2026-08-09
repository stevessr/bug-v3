import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const srcRoot = path.join(repoRoot, 'src')

function collectCssFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) collectCssFiles(target, result)
    else if (entry.isFile() && entry.name.endsWith('.css')) result.push(target)
  }
  return result
}

function collectScriptImportedCssFiles() {
  const imported = new Set()
  for (const file of collectSourceFiles(srcRoot)) {
    const source = fs.readFileSync(file, 'utf8')
    const importPattern = /import\s+(?:[^'"\n]+\s+from\s+)?['"]([^'"]+\.css)['"]/g
    for (const match of source.matchAll(importPattern)) {
      if (!match[1].startsWith('.')) continue
      imported.add(path.resolve(path.dirname(file), match[1]))
    }
  }
  return [...imported].filter(file => fs.existsSync(file))
}

function collectSourceFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) collectSourceFiles(target, result)
    else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|vue)$/.test(entry.name)) result.push(target)
  }
  return result
}

test('script-imported global CSS does not contain Vue SFC-only pseudo selectors', () => {
  const invalid = []
  for (const file of collectScriptImportedCssFiles()) {
    const source = fs.readFileSync(file, 'utf8')
    const lines = source.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      if (/:deep\(|:global\(/.test(line)) {
        invalid.push(`${path.relative(repoRoot, file)}:${index + 1}`)
      }
    }
  }
  assert.deepEqual(invalid, [])
})

test('scoped external CSS does not chain multiple deep selectors', () => {
  const invalid = []
  for (const file of collectCssFiles(srcRoot)) {
    const source = fs.readFileSync(file, 'utf8')
    const lines = source.split(/\r?\n/)
    for (const [index, line] of lines.entries()) {
      if ((line.match(/:deep\(/g) || []).length > 1) {
        invalid.push(`${path.relative(repoRoot, file)}:${index + 1}`)
      }
    }
  }
  assert.deepEqual(invalid, [])
})
