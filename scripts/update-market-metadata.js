import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MARKET_DIR = path.join(__dirname, 'cfworker/public/assets/market')
const METADATA_FILE = path.join(MARKET_DIR, 'metadata.json')
const MARKET_INDEX_DIR = path.join(__dirname, 'cfworker/public/assets/market/index')
const PAGE_SIZE = Number(process.env.MARKET_PAGE_SIZE || 50)

// Get all JSON files in the directory except metadata.json
const files = fs
  .readdirSync(MARKET_DIR)
  .filter(file => file.endsWith('.json') && file !== 'metadata.json')

const groups = []

files.forEach(file => {
  try {
    const content = fs.readFileSync(path.join(MARKET_DIR, file), 'utf8')
    const data = JSON.parse(content)

    // Extract group summary info
    const groupInfo = {
      id: data.id,
      name: data.name,
      icon: data.icon,
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
  fs.mkdirSync(MARKET_INDEX_DIR, { recursive: true })

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const pages = []

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * PAGE_SIZE
    const end = Math.min(start + PAGE_SIZE, groups.length)
    const pageGroups = groups.slice(start, end)
    const fileName = `page-${page}.json`
    const filePath = path.join(MARKET_INDEX_DIR, fileName)

    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          page,
          pageSize: PAGE_SIZE,
          totalPages,
          totalGroups: groups.length,
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

  const indexData = {
    version: '1.0',
    exportDate: metadata.exportDate,
    totalGroups: groups.length,
    pageSize: PAGE_SIZE,
    totalPages,
    pages
  }

  fs.writeFileSync(path.join(MARKET_INDEX_DIR, 'index.json'), JSON.stringify(indexData, null, 2))
  console.log(`Generated market index with ${totalPages} pages (page size ${PAGE_SIZE}).`)
} catch (err) {
  console.error('Error generating market index files:', err)
}

// Update MANIFEST_GROUPS in market-random.ts (only IDs for Snippet limitation)
const marketRandomFile = path.join(__dirname, 'cfworker/functions/api/market-random.ts')

try {
  let marketRandomContent = fs.readFileSync(marketRandomFile, 'utf8')

  // Extract only IDs from groups
  const groupIds = groups.map(g => `'${g.id}'`).join(', ')

  // Find and replace the MANIFEST_GROUPS constant
  const regex = /const MANIFEST_GROUPS: string\[\] = \[[\s\S]*?\n\]/
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
