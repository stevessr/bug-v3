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
  const panel = read('src/options/components/discourse/layout/QuickSidebarPanel.tsx')

  assert.match(component, /@fortawesome\/fontawesome-free\/css\/solid\.min\.css/)
  assert.doesNotMatch(notifications, /<path\s+d=/)
  assert.doesNotMatch(post, /<use href="#/)
  assert.doesNotMatch(search, /<path\s+d=/)
  assert.doesNotMatch(timeline, /<use href="#bookmark"/)
  assert.match(links, /<FaIcon name=\{link\.icon\}/)
  assert.match(panel, /<FaIcon name=\{item\.icon\}/)
  assert.doesNotMatch(panel, /getDiscourseIconHref|<use href=/)
})

test('site-provided Discourse symbols remain supported', () => {
  const sprite = read('src/options/components/discourse/layout/iconSprite.ts')
  assert.match(sprite, /GET_DISCOURSE_ICON_SPRITE/)
  assert.match(sprite, /cloneSafeElement/)
  assert.doesNotMatch(sprite, /innerHTML\s*=/)
})

test('Font Awesome Free provides glyphs for the built-in Discourse icon names', () => {
  // Font Awesome 7 keeps glyph class rules in fontawesome.min.css and the
  // solid font-face declaration in solid.min.css.
  const css = ['fontawesome.min.css', 'solid.min.css']
    .map(file =>
      readFileSync(
        new URL(`../../node_modules/@fortawesome/fontawesome-free/css/${file}`, import.meta.url),
        'utf8'
      )
    )
    .join('\\n')
  const iconSources = [
    read('src/options/components/discourse/notifications/NotificationsView.tsx'),
    read('src/options/components/discourse/topic/PostItem.tsx'),
    read('src/options/components/discourse/topic/TopicTimeline.tsx'),
    read('src/options/components/discourse/search/SearchView.tsx'),
    read('src/options/components/discourse/layout/Sidebar.tsx'),
    read('src/options/components/DiscourseBrowser.vue')
  ]
  const names = new Set()
  for (const source of iconSources) {
    for (const match of source.matchAll(/<FaIcon\s+name="([a-z-]+)"/g)) names.add(match[1])
    for (const match of source.matchAll(/\bicon:\s*'([a-z-]+)'/g)) names.add(match[1])
  }
  assert.ok(names.size > 15, 'expected to check fixed icons across multiple views')
  for (const name of names) {
    assert.match(
      css,
      new RegExp(`\\.fa-${name}::?before\\b`),
      `Missing Font Awesome Solid glyph for ${name}`
    )
  }
})
