import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { getDiscourseIconHref } from '../../src/options/components/discourse/layout/iconSprite.ts'

test('server-provided icons resolve against the active site sprite', () => {
  assert.equal(getDiscourseIconHref(null), '')
  assert.equal(getDiscourseIconHref('#bell'), '#bell')
  assert.equal(getDiscourseIconHref('discourse-chat-search'), '#discourse-chat-search')
  assert.equal(getDiscourseIconHref('https://example.com/icon.svg'), '')
})

test('icons come from the active site without a bundled forum snapshot', () => {
  assert.equal(fs.existsSync('public/assets/discourse-icons.svg'), false)

  const loader = fs.readFileSync('src/options/components/discourse/layout/iconSprite.ts', 'utf8')
  assert.match(loader, /GET_DISCOURSE_ICON_SPRITE/)
  assert.doesNotMatch(loader, /innerHTML\s*=/)
})
