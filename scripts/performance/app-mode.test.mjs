import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveExtensionSurface } from '../../src/utils/appMode.ts'

test('manifest mode selects each extension surface', () => {
  assert.equal(resolveExtensionSurface('?mode=popup').surface, 'popup')
  assert.equal(resolveExtensionSurface('?mode=options').surface, 'options')
  assert.equal(resolveExtensionSurface('?mode=sidebar').surface, 'sidebar')
})

test('type links remain compatible and take precedence over mode', () => {
  assert.equal(resolveExtensionSurface('?mode=popup&type=options').surface, 'options')
  assert.equal(resolveExtensionSurface('?type=sidebar').surface, 'sidebar')
})

test('an options route overrides popup but not an explicit sidebar', () => {
  assert.deepEqual(resolveExtensionSurface('?type=popup&tabs=groups'), {
    surface: 'options',
    requestedTab: 'groups'
  })
  assert.equal(resolveExtensionSurface('?mode=popup', '#/stats').surface, 'options')
  assert.equal(resolveExtensionSurface('?type=sidebar&tabs=groups', '#/stats').surface, 'sidebar')
})

test('unknown and empty modes safely fall back to popup', () => {
  assert.equal(resolveExtensionSurface('').surface, 'popup')
  assert.equal(resolveExtensionSurface('?mode=unknown').surface, 'popup')
})
