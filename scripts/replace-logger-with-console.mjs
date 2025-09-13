import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const exts = ['.ts', '.js', '.mjs', '.vue']
const skip = new Set([
  path.join(root, 'src', 'utils', 'logger.ts'),
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

function replaceLoggerUsage(content) {
  let changed = false
  const map = [
    [/logger\.dev\s*\(/g, 'console.debug('],
    [/logger\.log\s*\(/g, 'console.log('],
    [/logger\.warn\s*\(/g, 'console.warn('],
    [/logger\.error\s*\(/g, 'console.error(']
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

function replaceLoggerImport(content) {
  // Replace imports from src/config/buildFlags or buildFLagsV2 to utils/logger
  let out = content
  out = out.replace(/import\s+\{\s*logger\s*\}\s+from\s+['"][^'"\n]*config\/buildFlags['"];?/g, "import { logger } from '@/utils/logger'")
  out = out.replace(/import\s+\{\s*logger\s*\}\s+from\s+['"][^'"\n]*utils\/buildFLagsV2['"];?/g, "import { logger } from '@/utils/logger'")
  out = out.replace(/import\s+logger\s+from\s+['"][^'"\n]*config\/buildFlags['"];?/g, "import { logger } from '@/utils/logger'")
  out = out.replace(/import\s+logger\s+from\s+['"][^'"\n]*utils\/buildFLagsV2['"];?/g, "import { logger } from '@/utils/logger'")
  return out
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
    let raw = await fs.readFile(f, 'utf8')
    const { changed, out } = replaceLoggerUsage(raw)
    if (!changed) continue
    let newContent = out
    newContent = replaceLoggerImport(newContent)
    // If logger is used but no import present, ensure shim import exists
    if (/logger\./.test(newContent) && !/import\s+\{\s*logger\s*\}/.test(newContent)) {
      const importLines = newContent.match(/^import .*$/gm)
      if (!importLines) newContent = "import { logger } from '@/utils/logger'\n\n" + newContent
      else {
        const lastImport = importLines[importLines.length - 1]
        const idx = newContent.lastIndexOf(lastImport) + lastImport.length
        const before = newContent.slice(0, idx)
        const after = newContent.slice(idx)
        newContent = before + '\n' + "import { logger } from '@/utils/logger'" + after
      }
    }
    await fs.writeFile(f, newContent, 'utf8')
    changedFiles.push(f)
  }
  console.log('Replaced logger in files:', changedFiles.length)
  for (const cf of changedFiles) console.log('  -', path.relative(root, cf))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
