import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('built-in Discourse icons are backed by Font Awesome Free', () => {
  const component = read('src/options/components/discourse/layout/FaIcon.tsx')
  const notifications = read('src/options/components/discourse/notifications/NotificationsView.tsx')
  const post = read('src/options/components/discourse/topic/PostItem.tsx')
  const search = read('src/options/components/discourse/search/SearchView.tsx')
  const timeline = read('src/options/components/discourse/topic/TopicTimeline.tsx')
  const links = read('src/options/components/discourse/layout/SidebarQuickLinks.tsx')

  assert.match(component, /@fortawesome\/fontawesome-free\/css\/solid\.min\.css/)
  assert.doesNotMatch(notifications, /<path\s+d=/)
  assert.doesNotMatch(post, /<use href="#/)
  assert.doesNotMatch(search, /<path\s+d=/)
  assert.doesNotMatch(timeline, /<use href="#bookmark"/)
  assert.match(links, /<FaIcon name=\{link\.icon\}/)
})

test('site-provided Discourse symbols remain supported', () => {
  const sprite = read('src/options/components/discourse/layout/iconSprite.ts')
  assert.match(sprite, /GET_DISCOURSE_ICON_SPRITE/)
  assert.match(sprite, /cloneSafeElement/)
  assert.doesNotMatch(sprite, /innerHTML\s*=/)
})
