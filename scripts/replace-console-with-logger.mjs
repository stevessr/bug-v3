import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const exts = ['.ts', '.js', '.mjs', '.vue']
const skip = new Set([
  path.join(root, 'src', 'config', 'buildFlags.ts'),
  path.join(root, 'eslint.config.js')
])

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

function replaceConsole(content) {
  let changed = false
  const map = [
    [/console\.debug\s*\(/g, 'logger.dev('],
    [/console\.info\s*\(/g, 'logger.log('],
    [/console\.log\s*\(/g, 'logger.log('],
    [/console\.warn\s*\(/g, 'logger.warn('],
    [/console\.error\s*\(/g, 'logger.error(']
  ]
  let out = content
  for (const [re, rep] of map) {
    if (re.test(out)) {
      out = out.replace(re, rep)
      changed = true
    }
  }
  return { changed, out }
}

async function ensureLoggerImport(content) {
  if (
    /\bimport\s+\{[^}]*\blogger\b[^}]*\}\s+from/.test(content) ||
    /\bimport\s+logger\b/.test(content)
  )
    return content
  const importStatement = "import { logger } from '@/config/buildFlags'\n"
  const importLines = content.match(/^import .*$/gm)
  if (!importLines) return importStatement + '\n' + content
  const lastImport = importLines[importLines.length - 1]
  const idx = content.lastIndexOf(lastImport) + lastImport.length
  const before = content.slice(0, idx)
  const after = content.slice(idx)
  return before + '\n' + importStatement + after
}

async function main() {
  const files = await walk(root)
  const changedFiles = []
  for (const f of files) {
    if (skip.has(f)) continue
    if (
      !f.includes(path.join(root, 'src')) &&
      !f.includes(path.join(root, 'content')) &&
      !f.includes(path.join(root, 'background')) &&
      !f.includes(path.join(root, 'userscript')) &&
      !f.includes(path.join(root, 'popup')) &&
      !f.includes(path.join(root, 'options'))
    )
      continue
    const raw = await fs.readFile(f, 'utf8')
    const { changed, out } = replaceConsole(raw)
    if (!changed) continue
    let newContent = out
    newContent = await ensureLoggerImport(newContent)
    await fs.writeFile(f, newContent, 'utf8')
    changedFiles.push(f)
  }
  logger.log('Replaced console in files:', changedFiles.length)
  for (const cf of changedFiles) logger.log('  -', path.relative(root, cf))
}

main().catch(err => {
  logger.error(err)
  process.exit(1)
})
