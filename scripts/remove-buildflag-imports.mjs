import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const exts = ['.ts', '.js', '.mjs', '.vue']

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (
      full.includes('node_modules') ||
      full.includes('dist') ||
      full.includes('public') ||
      full.includes('playwright-report') ||
      full.includes('.git')
    )
      continue
    if (e.isDirectory()) {
      results.push(...(await walk(full)))
    } else if (e.isFile()) {
      if (exts.includes(path.extname(full))) results.push(full)
    }
  }
  return results
}

async function main() {
  const files = await walk(root)
  const changedFiles = []
  const importRegex = /import\s+\{[^}]*\}\s+from\s+(['"]).*?(buildFlags|buildFLagsV2).*?\1;?\n?/g

  for (const f of files) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      if (importRegex.test(raw)) {
        const newContent = raw.replace(importRegex, '')
        await fs.writeFile(f, newContent, 'utf8')
        changedFiles.push(f)
      }
    } catch (err) {
      console.error(`Error processing file ${f}:`, err)
    }
  }

  console.log('Removed build flag imports from files:', changedFiles.length)
  for (const cf of changedFiles) console.log('  -', path.relative(root, cf))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
