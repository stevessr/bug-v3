import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  TOUHOU_KEYWORDS,
  MAGIC_GIRL_KEYWORDS,
  术力口_KEYWORDS,
  galgame_keywords,
  mixed_keywords,
  test_keywords,
  game_keywords,
  anime_keywords,
  OC_KEYWORDS,
  超时空辉夜姬_KEYWORDS,
  keyword_match
} from './lib/constants.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MARKET_DIR = path.join(__dirname, 'cfworker/public/assets/market')
const METADATA_FILE = path.join(MARKET_DIR, 'metadata.json')
const MARKET_INDEX_DIR = path.join(__dirname, 'cfworker/public/assets/market/index')
const PAGE_SIZE = Number(process.env.MARKET_PAGE_SIZE || 48)
const MARKET_TOPICS = [
  { id: 'all', label: '全部' },
  { id: 'bilibili', label: 'bilibili' },
  { id: 'telegram', label: 'telegram' },
  { id: 'x', label: 'X' },
  { id: 'other', label: '其他' },
  { id: 'OC', label: 'OC' },
  { id: 'emoji', label: 'emoji' },
  { id: 'animated', label: '动画表情' },
  { id: 'linux.do', label: 'linux.do' },
  { id: 'tieba', label: '贴吧' },
  { id: '100', label: '100+' },
  { id: 'neuro', label: 'neuro' },
  { id: 'touhou', label: '东方' },
  { id: 'neko', label: 'neko' },
  { id: 'magic_girl', label: '魔法少女' },
  { id: 'idc', label: 'idc' },
  { id: '术力口', label: '术力口' },
  { id: 'galgame', label: 'galgame' },
  { id: 'acnfun', label: 'acfun' },
  { id: 'miexed', label: 'mixed' },
  { id: 'test', label: '测试' },
  { id: 'game', label: '游戏' },
  { id: 'anime', label: '动漫' },
  { id: '超时空辉夜姬', label: '超时空辉夜姬' }
]

function resolveMarketTopic(group) {
  const detail = String(group.detail || '').toLowerCase()
  const name = String(group.name || '')
    .trim()
    .toLowerCase()
  const len = group.emojiCount || group.emojis?.length || 0

  if (detail.includes('t.me') || detail.includes('telegram')) return 'telegram'
  if (detail.includes('bili')) return 'bilibili'
  if (name.startsWith('x')) return 'x'
  if (keyword_match(OC_KEYWORDS, name) || keyword_match(OC_KEYWORDS, detail)) return 'OC'
  if (name.includes('emoji')) return 'emoji'
  if (name.includes('animated') || name.includes('动图')) return 'animated'
  if (name.includes('linux.do') || detail.includes('linux.do')) return 'linux.do'
  if (name.includes('tieba') || detail.includes('tieba')) return 'tieba'
  if (name.includes('neuro') || detail.includes('neuron')) return 'neuro'

  if (keyword_match(TOUHOU_KEYWORDS, name) || keyword_match(TOUHOU_KEYWORDS, detail))
    return 'touhou'
  if (name.includes('neko')) return 'neko'
  if (keyword_match(MAGIC_GIRL_KEYWORDS, name) || keyword_match(MAGIC_GIRL_KEYWORDS, detail))
    return 'magic_girl'
  if (name.includes('idc') || detail.includes('idc')) return 'idc'
  if (keyword_match(术力口_KEYWORDS, name) || keyword_match(术力口_KEYWORDS, detail))
    return '术力口'
  if (keyword_match(galgame_keywords, name) || keyword_match(galgame_keywords, detail))
    return 'galgame'
  if (name.includes('acnfun') || detail.includes('acnfun')) return 'acnfun'
  if (keyword_match(mixed_keywords, name) || keyword_match(mixed_keywords, detail)) return 'miexed'
  if (keyword_match(test_keywords, name) || keyword_match(test_keywords, detail)) return 'test'
  if (keyword_match(game_keywords, name) || keyword_match(game_keywords, detail)) return 'game'
  if (keyword_match(anime_keywords, name) || keyword_match(anime_keywords, detail)) return 'anime'
  if (keyword_match(超时空辉夜姬_KEYWORDS, name) || keyword_match(超时空辉夜姬_KEYWORDS, detail))
    return '超时空辉夜姬'
  if (len > 100) return '100'
  return 'other'
}

// Get all JSON files in the directory except metadata.json
const files = fs
  .readdirSync(MARKET_DIR)
  .filter(file => file.endsWith('.json') && file !== 'metadata.json')

// Migrate legacy double-prefixed files produced by the old `group-${id}.json`
// naming when id already starts with 'group-' (e.g. group-group-123.json).
// New convention: file name is `${id}.json` when id starts with 'group-',
// otherwise `group-${id}.json`.
for (const file of fs.readdirSync(MARKET_DIR)) {
  const legacyMatch = /^group-group-(.+)\.json$/.exec(file)
  if (!legacyMatch) continue
  const targetName = `group-${legacyMatch[1]}.json`
  const sourcePath = path.join(MARKET_DIR, file)
  const targetPath = path.join(MARKET_DIR, targetName)
  try {
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
    if (fs.existsSync(targetPath)) {
      const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
      if (targetData.id && sourceData.id && targetData.id === sourceData.id) {
        fs.rmSync(sourcePath)
        console.log(`Removed duplicate legacy file ${file} (${targetName} exists)`)
      } else {
        console.warn(`Skipping ${file}: ${targetName} exists with different group id`)
      }
    } else {
      fs.renameSync(sourcePath, targetPath)
      console.log(`Renamed legacy file ${file} -> ${targetName}`)
    }
  } catch (err) {
    console.error(`Error migrating ${file}:`, err)
  }
}
const groups = []

files.forEach(file => {
  try {
    const content = fs.readFileSync(path.join(MARKET_DIR, file), 'utf8')
    const data = JSON.parse(content)

    // Skip non-group JSON files (e.g. topics.json leftovers) without a valid id
    if (!data || typeof data.id !== 'string' || !data.id) return

    // Enforce canonical file naming: `${id}.json` when id starts with 'group-',
    // otherwise `group-${id}.json`. Skips stray downloads like "xxx (1).json".
    const expectedName = data.id.startsWith('group-') ? `${data.id}.json` : `group-${data.id}.json`
    if (file !== expectedName) {
      console.warn(`Skipping ${file}: expected ${expectedName} for group id ${data.id}`)
      return
    }

    // Extract group summary info
    const groupInfo = {
      id: data.id,
      name: data.name,
      icon: data.icon,
      detail: data.detail,
      topic: resolveMarketTopic(data),
      order: data.order || 0,
      emojiCount: data.emojis ? data.emojis.length : 0,
      isArchived: !!data.isArchived // Use isArchived from file if exists, default false
    }

    groups.push(groupInfo)
  } catch (err) {
    console.error(`Error reading ${file}:`, err)
  }
})

// We need to preserve isArchived status from existing metadata.json if possible
let existingMetadata = {}
try {
  if (fs.existsSync(METADATA_FILE)) {
    const content = fs.readFileSync(METADATA_FILE, 'utf8')
    existingMetadata = JSON.parse(content)
  }
} catch (err) {
  console.warn('Could not read existing metadata.json, starting fresh')
}

// Map existing archived status
const existingGroupsMap = new Map()
if (existingMetadata.groups) {
  existingMetadata.groups.forEach(g => {
    existingGroupsMap.set(g.id, g)
  })
}

// Update groups with preserved metadata
groups.forEach(group => {
  const existing = existingGroupsMap.get(group.id)
  if (existing) {
    // Preserve manually set properties if they are not in the individual files
    // logic: if individual file doesn't have isArchived, take from existing metadata
    if (group.isArchived === false && existing.isArchived) {
      group.isArchived = existing.isArchived
    }

    // It seems the source files don't have isArchived at all in the examples shown.
    // So we should default to what's in metadata.json, or false if new.
    if (existing.isArchived !== undefined) {
      group.isArchived = existing.isArchived
    }
  }
})

// Sort groups by initial letter, then by full name
const getSortName = name => (name || '').trim()
const getInitial = name => getSortName(name).slice(0, 1).toLowerCase()
groups.sort((a, b) => {
  const aInitial = getInitial(a.name)
  const bInitial = getInitial(b.name)
  const initialCompare = aInitial.localeCompare(bInitial, 'en', { sensitivity: 'base' })
  if (initialCompare !== 0) return initialCompare
  return getSortName(a.name).localeCompare(getSortName(b.name), 'en', { sensitivity: 'base' })
})

// Generate order values based on name sorting
for (let i = 0; i < groups.length; i++) {
  groups[i].order = i
}

// Compute per-topic statistics once so metadata.json and index files stay consistent.
const topicStats = MARKET_TOPICS.map(topic => {
  const totalGroups =
    topic.id === 'all' ? groups.length : groups.filter(group => group.topic === topic.id).length
  return {
    id: topic.id,
    label: topic.label,
    totalGroups,
    totalPages: Math.max(1, Math.ceil(totalGroups / PAGE_SIZE))
  }
})

const metadata = {
  version: '1.0',
  exportDate: new Date().toISOString(),
  totalGroups: groups.length,
  includeArchived: true,
  groups: groups
}

fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))
console.log(`Generated metadata.json with ${groups.length} groups.`)

// Generate paginated index files for market browsing
try {
  fs.rmSync(MARKET_INDEX_DIR, { recursive: true, force: true })
  fs.mkdirSync(MARKET_INDEX_DIR, { recursive: true })

  // Standalone topics file so clients can fetch available categories without
  // downloading the full metadata.json group list. Written after the index dir
  // cleanup above so it survives regeneration.
  fs.writeFileSync(
    path.join(MARKET_INDEX_DIR, 'topics.json'),
    JSON.stringify(
      {
        version: '1.0',
        exportDate: metadata.exportDate,
        totalGroups: groups.length,
        topics: topicStats
      },
      null,
      2
    )
  )
  console.log(`Generated topics.json with ${topicStats.length} topics.`)

  const topicIndexes = topicStats.map(topic => {
    const topicGroups =
      topic.id === 'all' ? groups : groups.filter(group => group.topic === topic.id)
    const totalPages = topic.totalPages
    const pages = []

    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * PAGE_SIZE
      const end = Math.min(start + PAGE_SIZE, topicGroups.length)
      const pageGroups = topicGroups.slice(start, end)
      const fileName = topic.id === 'all' ? `page-${page}.json` : `${topic.id}-page-${page}.json`
      const filePath = path.join(MARKET_INDEX_DIR, fileName)

      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            topic: topic.id,
            page,
            pageSize: PAGE_SIZE,
            totalPages,
            totalGroups: topicGroups.length,
            groups: pageGroups
          },
          null,
          2
        )
      )

      pages.push({
        name: fileName,
        start: start + 1,
        end,
        count: pageGroups.length
      })
    }

    return {
      id: topic.id,
      label: topic.label,
      totalGroups: topicGroups.length,
      totalPages,
      pages
    }
  })

  const allTopicIndex = topicIndexes.find(topic => topic.id === 'all')
  const indexData = {
    version: '1.0',
    exportDate: metadata.exportDate,
    totalGroups: groups.length,
    pageSize: PAGE_SIZE,
    totalPages: allTopicIndex.totalPages,
    pages: allTopicIndex.pages,
    topics: topicIndexes
  }

  fs.writeFileSync(path.join(MARKET_INDEX_DIR, 'index.json'), JSON.stringify(indexData, null, 2))
  console.log(
    `Generated market index with ${allTopicIndex.totalPages} pages (page size ${PAGE_SIZE}).`
  )
  console.log(
    `Generated topic indexes: ${topicIndexes.map(t => `${t.id}=${t.totalGroups}`).join(', ')}.`
  )
} catch (err) {
  console.error('Error generating market index files:', err)
}

// Update MANIFEST_GROUPS in the market Pages Function with current group IDs.
const marketRandomFile = path.join(__dirname, 'cfworker/functions/api/market-random.ts')

try {
  let marketRandomContent = fs.readFileSync(marketRandomFile, 'utf8')

  // Extract only IDs from groups
  const groupIds = groups.map(g => `'${g.id}'`).join(', ')

  // Find and replace the MANIFEST_GROUPS constant
  const regex = /const MANIFEST_GROUPS(?::[^=]+)?= \[[\s\S]*?\n\]/
  const newManifestGroups = `const MANIFEST_GROUPS: string[] = [\n  ${groupIds}\n]`

  if (regex.test(marketRandomContent)) {
    marketRandomContent = marketRandomContent.replace(regex, newManifestGroups)
    fs.writeFileSync(marketRandomFile, marketRandomContent)
    console.log(`Updated MANIFEST_GROUPS in market-random.ts with ${groups.length} group IDs.`)
  } else {
    console.error('Could not find MANIFEST_GROUPS constant in market-random.ts')
  }
} catch (err) {
  console.error('Error updating market-random.ts:', err)
}
