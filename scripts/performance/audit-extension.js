#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '../..')

const ENTRY_DEFINITIONS = {
  bootstrap: ['index.html'],
  content: ['src/content/content.ts'],
  background: ['src/background/background.ts'],
  popup: ['index.html', 'src/popup/main.ts'],
  sidebar: ['index.html', 'src/sidebar/main.ts'],
  options: ['index.html', 'src/options/main.ts'],
  discourse: ['discourse.html']
}

const PERFORMANCE_REPORT_NAME = 'performance-audit.json'

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

export function collectStaticGraph(manifest, roots) {
  const pending = [...roots]
  const visited = new Set()

  while (pending.length > 0) {
    const key = pending.pop()
    if (!key || visited.has(key)) continue
    const chunk = manifest[key]
    if (!chunk) continue
    visited.add(key)
    for (const importedKey of chunk.imports || []) pending.push(importedKey)
  }

  return visited
}

function walkFiles(directory, baseDirectory = directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath, baseDirectory))
      continue
    }
    const relativePath = path.relative(baseDirectory, absolutePath).split(path.sep).join('/')
    if (relativePath === PERFORMANCE_REPORT_NAME) continue
    files.push({
      path: relativePath,
      absolutePath,
      bytes: fs.statSync(absolutePath).size
    })
  }
  return files
}

function resolveInitialFiles(manifest, rootKeys, distFilesByPath) {
  const graph = collectStaticGraph(manifest, rootKeys)
  const paths = new Set()

  for (const key of graph) {
    const chunk = manifest[key]
    if (!chunk) continue
    if (chunk.file) paths.add(chunk.file)
    for (const cssFile of chunk.css || []) paths.add(cssFile)
  }

  const files = [...paths]
    .map(filePath => distFilesByPath.get(filePath))
    .filter(Boolean)
    .sort((a, b) => b.bytes - a.bytes)

  return {
    manifestKeys: [...graph].sort(),
    files: files.map(({ path: filePath, bytes }) => ({ path: filePath, bytes })),
    jsBytes: files
      .filter(file => file.path.endsWith('.js'))
      .reduce((sum, file) => sum + file.bytes, 0),
    cssBytes: files
      .filter(file => file.path.endsWith('.css'))
      .reduce((sum, file) => sum + file.bytes, 0)
  }
}

function findDuplicateAssets(files, minimumBytes) {
  const byHash = new Map()
  for (const file of files) {
    if (file.bytes < minimumBytes) continue
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file.absolutePath)).digest('hex')
    const duplicateGroup = byHash.get(digest) || []
    duplicateGroup.push({ path: file.path, bytes: file.bytes })
    byHash.set(digest, duplicateGroup)
  }
  return [...byHash.values()].filter(group => group.length > 1)
}

function scanSourceInvariants(rootDir) {
  const checks = []
  const contentEntry = fs.readFileSync(path.join(rootDir, 'src/content/content.ts'), 'utf8')
  const staticImports = [...contentEntry.matchAll(/^import\s+(?!type\b)[^'"\n]*['"]([^'"]+)['"]/gm)].map(
    match => match[1]
  )
  const forbiddenImports = staticImports.filter(specifier =>
    /(?:discourse|messageHandlers(?:\/index)?$|utils\/init|simpleStorage|stores|^(?:vue|pinia|ant-design-vue)$)/.test(
      specifier
    )
  )
  checks.push({
    id: 'source.content-bootstrap-static-imports',
    passed: forbiddenImports.length === 0,
    actual: forbiddenImports,
    message:
      forbiddenImports.length === 0
        ? 'All-pages content bootstrap keeps heavy features lazy.'
        : `Heavy static imports found: ${forbiddenImports.join(', ')}`
  })

  const simpleStorage = fs.readFileSync(path.join(rootDir, 'src/utils/simpleStorage.ts'), 'utf8')
  const importsVue = /from\s+['"]vue['"]/.test(simpleStorage)
  checks.push({
    id: 'source.background-storage-without-vue',
    passed: !importsVue,
    actual: importsVue,
    message: importsVue
      ? 'simpleStorage imports Vue and makes the service worker parse the UI runtime.'
      : 'Storage serialization is independent from the Vue UI runtime.'
  })

  const contentInit = fs.readFileSync(path.join(rootDir, 'src/content/utils/init.ts'), 'utf8')
  const initializationReferences = contentInit.match(/initializeEmojiFeature\s*\(/g)?.length || 0
  checks.push({
    id: 'source.no-recursive-content-initialization',
    passed: initializationReferences === 1,
    actual: initializationReferences,
    message:
      initializationReferences === 1
        ? 'Content initialization does not recursively duplicate observers and timers.'
        : 'initializeEmojiFeature calls itself and can duplicate long-lived resources.'
  })

  return checks
}

export function auditExtension({
  rootDir = DEFAULT_ROOT,
  distDir = path.join(rootDir, 'dist'),
  budgetsPath = path.join(rootDir, 'scripts/performance/budgets.json'),
  scanSource = true
} = {}) {
  const manifestPath = path.join(distDir, '.vite/manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing ${path.relative(rootDir, manifestPath)}. Run "pnpm build:perf" before auditing.`
    )
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'))
  const files = walkFiles(distDir)
  const filesByPath = new Map(files.map(file => [file.path, file]))
  const totalDistBytes = files.reduce((sum, file) => sum + file.bytes, 0)
  const jsFiles = files.filter(file => file.path.endsWith('.js')).sort((a, b) => b.bytes - a.bytes)
  const largestJsChunk = jsFiles[0] || { path: '', bytes: 0 }
  const entries = {}
  const checks = []

  for (const [entryName, rootKeys] of Object.entries(ENTRY_DEFINITIONS)) {
    const missingRoots = rootKeys.filter(key => !manifest[key])
    if (missingRoots.length > 0) {
      checks.push({
        id: `entry.${entryName}.present`,
        passed: false,
        actual: missingRoots,
        message: `Manifest entries missing: ${missingRoots.join(', ')}`
      })
      continue
    }

    const summary = resolveInitialFiles(manifest, rootKeys, filesByPath)
    entries[entryName] = summary
    const budget = budgets.entries?.[entryName]
    if (typeof budget === 'number') {
      checks.push({
        id: `entry.${entryName}.initial-js`,
        passed: summary.jsBytes <= budget,
        actual: summary.jsBytes,
        budget,
        message: `${entryName} initial JS: ${formatBytes(summary.jsBytes)} / ${formatBytes(budget)}`
      })
    }

    const forbiddenPatterns = budgets.forbiddenInitialChunks?.[entryName] || []
    const forbiddenFiles = summary.files
      .map(file => file.path)
      .filter(filePath => forbiddenPatterns.some(pattern => filePath.includes(pattern)))
    checks.push({
      id: `entry.${entryName}.forbidden-chunks`,
      passed: forbiddenFiles.length === 0,
      actual: forbiddenFiles,
      message:
        forbiddenFiles.length === 0
          ? `${entryName} has no forbidden eager chunks.`
          : `${entryName} eagerly loads: ${forbiddenFiles.join(', ')}`
    })
  }

  checks.push({
    id: 'dist.total-size',
    passed: totalDistBytes <= budgets.totalDistBytes,
    actual: totalDistBytes,
    budget: budgets.totalDistBytes,
    message: `Package size: ${formatBytes(totalDistBytes)} / ${formatBytes(budgets.totalDistBytes)}`
  })
  checks.push({
    id: 'dist.largest-js-chunk',
    passed: largestJsChunk.bytes <= budgets.maxJsChunkBytes,
    actual: largestJsChunk,
    budget: budgets.maxJsChunkBytes,
    message: `Largest JS chunk: ${largestJsChunk.path} (${formatBytes(largestJsChunk.bytes)})`
  })

  const duplicateAssets = findDuplicateAssets(files, budgets.maxDuplicateAssetBytes)
  checks.push({
    id: 'dist.duplicate-large-assets',
    passed: duplicateAssets.length === 0,
    actual: duplicateAssets,
    message:
      duplicateAssets.length === 0
        ? 'No byte-identical large assets were emitted more than once.'
        : `${duplicateAssets.length} duplicated large asset group(s) found.`
  })

  if (scanSource) checks.push(...scanSourceInvariants(rootDir))

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    passed: checks.every(check => check.passed),
    totalDistBytes,
    fileCount: files.length,
    largestFiles: files
      .slice()
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 15)
      .map(({ path: filePath, bytes }) => ({ path: filePath, bytes })),
    entries,
    checks
  }
}

function parseArguments(argv) {
  const args = { check: false, write: true, outputPath: null }
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--check') args.check = true
    else if (argument === '--no-write') args.write = false
    else if (argument === '--json') args.outputPath = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  return args
}

function printReport(report) {
  console.log('\nExtension performance audit')
  console.log('='.repeat(31))
  for (const [name, entry] of Object.entries(report.entries)) {
    console.log(
      `${name.padEnd(10)} JS ${formatBytes(entry.jsBytes).padStart(10)}  CSS ${formatBytes(entry.cssBytes).padStart(10)}`
    )
  }
  console.log(`\nPackage    ${formatBytes(report.totalDistBytes)}`)
  console.log('\nChecks')
  for (const check of report.checks) {
    console.log(`${check.passed ? '✓' : '✗'} ${check.message}`)
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  try {
    const args = parseArguments(process.argv.slice(2))
    const report = auditExtension()
    printReport(report)

    if (args.write) {
      const outputPath = args.outputPath
        ? path.resolve(args.outputPath)
        : path.join(DEFAULT_ROOT, 'dist', PERFORMANCE_REPORT_NAME)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
      console.log(`\nReport: ${path.relative(DEFAULT_ROOT, outputPath)}`)
    }

    if (args.check && !report.passed) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
