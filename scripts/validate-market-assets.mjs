#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const projectRoot = process.cwd()
const marketDir = path.join(projectRoot, 'scripts/cfworker/public/assets/market')
const metadataPath = path.join(marketDir, 'metadata.json')
const indexDir = path.join(marketDir, 'index')
const indexPath = path.join(indexDir, 'index.json')
const marketRandomPath = path.join(projectRoot, 'scripts/cfworker/functions/api/market-random.ts')

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.relative(projectRoot, filePath)}: ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sortedIds(groups) {
  return groups.map(group => group.id).sort()
}

function assertSameIds(expected, actual, label) {
  const expectedIds = [...expected].sort()
  const actualIds = [...actual].sort()
  assert(
    JSON.stringify(expectedIds) === JSON.stringify(actualIds),
    `${label} does not match market source IDs`
  )
}

function collectIndexPageNames(index) {
  const pageNames = new Set()

  for (const topic of index.topics || []) {
    for (const page of topic.pages || []) {
      assert(
        typeof page.name === 'string' && page.name.length > 0,
        'Market index contains a page without a name'
      )
      pageNames.add(page.name)
    }
  }

  return pageNames
}

function validateMarketAssets() {
  assert(fs.existsSync(marketDir), `Market directory does not exist: ${marketDir}`)

  const sourceFiles = fs
    .readdirSync(marketDir, { withFileTypes: true })
    .filter(
      entry => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'metadata.json'
    )
    .map(entry => entry.name)
    .sort()

  assert(sourceFiles.length > 0, 'No market emoji group JSON files found')

  const sourceGroups = sourceFiles.map(fileName => {
    const group = readJson(path.join(marketDir, fileName))
    assert(group && typeof group === 'object', `${fileName} must contain an object`)
    assert(typeof group.id === 'string' && group.id.length > 0, `${fileName} is missing a group id`)
    assert(Array.isArray(group.emojis), `${fileName} is missing an emojis array`)
    const canonicalBaseName = group.id.startsWith('group-')
      ? group.id
      : 'group-' + group.id
    const canonicalFileName = canonicalBaseName + '.json'
    const isLegacyDuplicate =
      fileName.startsWith(canonicalBaseName + ' (') && fileName.endsWith(').json')
    assert(
      fileName === canonicalFileName || isLegacyDuplicate,
      `${fileName} does not match its group id`
    )
    if (isLegacyDuplicate) {
      console.warn(`Legacy duplicate market export retained: ${fileName}`)
    }
    return group
  })

  const metadata = readJson(metadataPath)
  assert(Array.isArray(metadata.groups), 'market/metadata.json is missing groups')
  assert(metadata.totalGroups === sourceGroups.length, 'market/metadata.json totalGroups is stale')
  assert(metadata.groups.length === sourceGroups.length, 'market/metadata.json groups is stale')
  assertSameIds(sortedIds(sourceGroups), sortedIds(metadata.groups), 'market/metadata.json')

  const sourceEmojiCounts = new Map(sourceGroups.map(group => [group.id, group.emojis.length]))
  for (const group of metadata.groups) {
    assert(
      sourceEmojiCounts.get(group.id) === group.emojiCount,
      `market/metadata.json has a stale emojiCount for ${group.id}`
    )
  }

  const index = readJson(indexPath)
  assert(index.totalGroups === sourceGroups.length, 'market/index/index.json totalGroups is stale')
  assert(
    Array.isArray(index.topics) && index.topics.length > 0,
    'market/index/index.json has no topics'
  )

  const pageNames = collectIndexPageNames(index)
  for (const pageName of pageNames) {
    const page = readJson(path.join(indexDir, pageName))
    assert(Array.isArray(page.groups), `${pageName} is missing groups`)
  }

  const marketRandom = fs.readFileSync(marketRandomPath, 'utf8')
  assert(
    /export const onRequest:\s*PagesFunction/.test(marketRandom),
    'market-random.ts must export a Cloudflare Pages onRequest handler'
  )
  const manifestMatch = marketRandom.match(/const MANIFEST_GROUPS[\s\S]*?= \[([\s\S]*?)\n\]/)
  assert(manifestMatch, 'market-random.ts is missing generated MANIFEST_GROUPS')

  const manifestIds = [...manifestMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1])
  assertSameIds(
    sourceGroups.map(group => group.id),
    manifestIds,
    'market-random.ts MANIFEST_GROUPS'
  )

  console.log(
    `Validated ${sourceGroups.length} market groups, ${pageNames.size} index pages, and ${manifestIds.length} random API IDs.`
  )
}

try {
  validateMarketAssets()
} catch (error) {
  console.error(`Market asset validation failed: ${error.message}`)
  process.exitCode = 1
}
