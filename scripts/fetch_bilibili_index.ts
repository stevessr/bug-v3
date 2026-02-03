import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.resolve(__dirname, 'cfworker/public/assets/bilibili')
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.json')
const CONCURRENCY = 20
const MIN_ID = 1
const MAX_ID = 9166

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

interface BilibiliEmotePackageLite {
  id: number
  text: string
  url: string
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
  console.log(`Scanning Bilibili emote packages ${MIN_ID}-${MAX_ID} for index generation...`)

  const results: BilibiliEmotePackageLite[] = []
  const tasks: Promise<void>[] = []

  async function worker(idIterator: IterableIterator<number>) {
    for (const id of idIterator) {
      const pkg = await fetchPackageLite(id)
      if (pkg) {
        results.push(pkg)
        console.log(`[FOUND] ${pkg.id}: ${pkg.text}`)
      } else {
        process.stdout.write('.')
      }
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }

  function* range(start: number, end: number) {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  const iterator = range(MIN_ID, MAX_ID)

  for (let i = 0; i < CONCURRENCY; i++) {
    tasks.push(worker(iterator))
  }

  await Promise.all(tasks)

  results.sort((a, b) => a.id - b.id)

  fs.writeFileSync(INDEX_FILE, JSON.stringify(results, null, 2))

  console.log(`\nScan complete. Found ${results.length} valid packages.`)
  console.log(`Index saved to ${INDEX_FILE}`)
}

main().catch(console.error)
