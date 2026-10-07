import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.resolve(__dirname, 'cfworker/public/assets/bilibili')
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.json')
const CONCURRENCY = 20
const DEFAULT_MAX_ID = 10289
const MAX_CONSECUTIVE_MISSES = 100

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

interface BilibiliEmotePackageLite {
  id: number
  text: string
  url: string
}

function readExistingIndex(): BilibiliEmotePackageLite[] {
  if (!fs.existsSync(INDEX_FILE)) return []
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    if (!Array.isArray(parsed)) throw new Error('expected an array')
    return parsed.filter(
      (item): item is BilibiliEmotePackageLite =>
        typeof item === 'object' &&
        item !== null &&
        Number.isSafeInteger((item as BilibiliEmotePackageLite).id) &&
        typeof (item as BilibiliEmotePackageLite).text === 'string' &&
        typeof (item as BilibiliEmotePackageLite).url === 'string'
    )
  } catch (error) {
    throw new Error(`Cannot read existing index ${INDEX_FILE}: ${String(error)}`)
  }
}

function parseIdOption(name: string): number | undefined {
  const prefix = `--${name}=`
  const args = process.argv.slice(2)
  const inlineArgument = args.find(value => value.startsWith(prefix))
  const index = args.indexOf(`--${name}`)
  const argument = inlineArgument ?? (index >= 0 ? args[index + 1] : undefined)
  if (!argument) return undefined
  const rawValue = inlineArgument ? argument.slice(prefix.length) : argument
  const value = Number(rawValue)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid --${name} value: ${rawValue}`)
  }
  return value
}

function showHelp() {
  console.log(`Usage: node scripts/fetch_bilibili_index.ts [options]

Continue scanning after the largest ID in the existing index, append new packages
to scripts/cfworker/public/assets/bilibili/index.json, and deduplicate by ID.

Options:
  --from ID   Start scanning at ID (default: existing maximum ID + 1)
  --to ID     Stop at ID (default: start ID + 9999 or 10289, whichever is greater)
  --help      Show this help

The scan stops after 100 consecutive IDs return no package.`)
}

async function fetchPackageLite(id: number): Promise<BilibiliEmotePackageLite | null> {
  try {
    const response = await fetch(
      `https://api.bilibili.com/x/emote/package?ids=${id}&business=reply`,
      {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.code !== 0 || !data.data || !data.data.packages || data.data.packages.length === 0) {
      return null
    }

    const pkg = data.data.packages[0]
    return {
      id: pkg.id,
      text: pkg.text,
      url: pkg.url
    }
  } catch (error) {
    return null
  }
}

async function main() {
  if (process.argv.slice(2).includes('--help') || process.argv.slice(2).includes('-h')) {
    showHelp()
    return
  }
  const existing = readExistingIndex()
  const existingMaxId = existing.reduce((max, item) => Math.max(max, item.id), -1)
  const startId = parseIdOption('from') ?? existingMaxId + 1
  const endId = parseIdOption('to') ?? Math.max(DEFAULT_MAX_ID, existingMaxId + 10_000)
  if (endId < startId) {
    throw new Error(`End ID ${endId} is lower than start ID ${startId}`)
  }
  console.log(
    `Scanning Bilibili emote packages ${startId}-${endId} (append after existing ID ${existingMaxId})...`
  )

  const merged = new Map(existing.map(item => [item.id, item]))
  let foundCount = 0
  let consecutiveMisses = 0
  let stoppedAt: number | undefined

  // Fetch concurrently in small ordered batches. Results are printed and counted by ID order,
  // so the 100-consecutive-miss cutoff remains exact without spawning worker processes.
  for (let batchStart = startId; batchStart <= endId; batchStart += CONCURRENCY) {
    const ids = Array.from(
      { length: Math.min(CONCURRENCY, endId - batchStart + 1) },
      (_, index) => batchStart + index
    )
    const packages = await Promise.all(ids.map(id => fetchPackageLite(id)))

    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]
      const pkg = packages[index]
      if (pkg) {
        if (consecutiveMisses > 0) process.stdout.write('\n')
        merged.set(pkg.id, pkg)
        foundCount++
        consecutiveMisses = 0
        console.log(`[FOUND] ${pkg.id}: ${pkg.text}`)
      } else {
        consecutiveMisses++
        process.stdout.write('.')
        if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
          stoppedAt = id
          break
        }
      }
    }

    if (stoppedAt !== undefined) break
    await new Promise(resolve => setTimeout(resolve, 30))
  }

  const sorted = [...merged.values()].sort((a, b) => a.id - b.id)

  fs.writeFileSync(INDEX_FILE, JSON.stringify(sorted, null, 2))

  process.stdout.write('\n')
  console.log(
    `\nScan complete. Found ${foundCount} new packages; index now contains ${sorted.length} packages.`
  )
  if (stoppedAt !== undefined) {
    console.log(
      `Stopped at ID ${stoppedAt} after ${MAX_CONSECUTIVE_MISSES} consecutive missing packages.`
    )
  }
  console.log(`Index saved to ${INDEX_FILE}`)
}

main().catch(console.error)
