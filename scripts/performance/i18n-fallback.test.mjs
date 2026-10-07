import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../src/utils/i18n.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const module = { exports: {} }
new Function('exports', code)(module.exports)
const { getMessage, formatMessage } = module.exports

test('Chrome fallback handles no arguments, named counts including zero, and positional arguments', () => {
  const previous = globalThis.chrome
  const calls = []
  globalThis.chrome = {
    i18n: {
      getMessage(key, args) {
        calls.push([key, args])
        return (
          {
            virtualGroup: '（虚拟分组）',
            showAllEmojis: '共 {count} 个表情',
            positional: `次数 ${args?.[0]}`
          }[key] || ''
        )
      }
    }
  }
  try {
    assert.equal(getMessage('virtualGroup'), '（虚拟分组）')
    assert.equal(getMessage('showAllEmojis', { count: 0 }), '共 0 个表情')
    assert.equal(getMessage('showAllEmojis', { count: 12 }), '共 12 个表情')
    assert.equal(getMessage('positional', ['3']), '次数 3')
    assert.equal(formatMessage('{count}', { count: 0 }), '0')
    assert.deepEqual(calls[0], ['virtualGroup', undefined])
  } finally {
    globalThis.chrome = previous
  }
})
