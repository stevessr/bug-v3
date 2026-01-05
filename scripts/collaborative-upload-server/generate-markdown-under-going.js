#!/usr/bin/env node
/**
 * Generate markdown files for each group JSON.
 *
 * Usage:
 *   node scripts/collaborative-upload-server/generate-markdown-under-going.js \
 *     --input scripts/cfworker/public/assets/market \
 *     --output scripts/cfworker/public/assets/market
 *
 *   # Or from progress log (optionally map to existing JSON names)
 *   node scripts/collaborative-upload-server/generate-markdown-under-going.js \
 *     --progress-log scripts/under_going/.work/progress.log \
 *     --json-dir scripts/cfworker/public/assets/market \
 *     --output scripts/cfworker/public/assets/market
 */

import fs from 'fs'
import path from 'path'
import { ensureDir, readProgressLog } from './processing-utils.js'

const DEFAULT_INPUT_DIR = path.resolve(process.cwd(), 'scripts/cfworker/public/assets/market')
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/cfworker/public/assets/market')
const DEFAULT_PROGRESS_LOG = path.resolve(process.cwd(), 'scripts/under_going/.work/progress.log')

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT_DIR,
    output: DEFAULT_OUTPUT_DIR,
    progressLog: null,
    jsonDir: null
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--input':
        args.input = path.resolve(process.cwd(), argv[++i])
        break
      case '--output':
        args.output = path.resolve(process.cwd(), argv[++i])
        break
      case '--progress-log':
        args.progressLog = path.resolve(process.cwd(), argv[++i])
        break
      case '--json-dir':
        args.jsonDir = path.resolve(process.cwd(), argv[++i])
        break
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option ignored: ${arg}`)
        }
        break
    }
  }

  return args
}

function listGroupJsonFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.json') && file !== 'metadata.json')
    .sort()
    .map(file => path.join(dir, file))
}

function buildMarkdownLines(items) {
  const lines = items
    .filter(item => item && item.url)
    .map(item => {
      const name = item?.name ?? ''
      const height = item?.height ?? ''
      const width = item?.width ?? ''
      return `![${name}|${height}x${width}](${item.url})`
    })
  return lines
}

function buildMarkdown(groupJson) {
  const emojis = Array.isArray(groupJson?.emojis) ? groupJson.emojis : []
  const lines = buildMarkdownLines(emojis)

  if (lines.length === 0) return null
  return `>[!summary]-\n>[grid]\n>${lines.join('\n>')}\n>[/grid]`
}

function sanitizeFileBase(name) {
  const cleaned = String(name || '').trim().replace(/[\\/]/g, '_')
  return cleaned || 'group'
}

function mapGroupNameToJsonBase(jsonDir) {
  if (!jsonDir || !fs.existsSync(jsonDir)) return new Map()
  const mapping = new Map()
  const jsonFiles = listGroupJsonFiles(jsonDir)
  for (const jsonPath of jsonFiles) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8')
      const data = JSON.parse(raw)
      if (data?.name) {
        mapping.set(String(data.name), path.parse(jsonPath).name)
      }
    } catch {
      // ignore invalid JSON
    }
  }
  return mapping
}

function buildGroupsFromProgress(progressLog) {
  const progress = readProgressLog(progressLog)
  const groupMap = new Map()

  for (const [key, record] of progress.converted.entries()) {
    const [groupName, name] = String(key).split('::')
    if (!groupName || !name) continue
    const entry = groupMap.get(groupName) || new Map()
    const existing = entry.get(name) || { name, url: null, width: null, height: null }
    if (record?.width) existing.width = record.width
    if (record?.height) existing.height = record.height
    entry.set(name, existing)
    groupMap.set(groupName, entry)
  }

  for (const [key, record] of progress.uploaded.entries()) {
    const [groupName, name] = String(key).split('::')
    if (!groupName || !name || !record?.url) continue
    const entry = groupMap.get(groupName) || new Map()
    const existing = entry.get(name) || { name, url: null, width: null, height: null }
    existing.url = record.url
    entry.set(name, existing)
    groupMap.set(groupName, entry)
  }

  const results = new Map()
  for (const [groupName, items] of groupMap.entries()) {
    const list = Array.from(items.values()).filter(item => item.url)
    if (list.length === 0) continue
    list.sort((a, b) => a.name.localeCompare(b.name))
    results.set(groupName, list)
  }

  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.progressLog) {
    args.progressLog = DEFAULT_PROGRESS_LOG
  }
  console.log('Starting generate-markdown-under-going with args:', args)

  ensureDir(args.output)

  if (args.progressLog && fs.existsSync(args.progressLog)) {
    const nameMapping = mapGroupNameToJsonBase(args.jsonDir || args.input)
    const groups = buildGroupsFromProgress(args.progressLog)
    if (groups.size === 0) {
      console.log(`No uploaded entries found in ${args.progressLog}`)
      return
    }

    for (const [groupName, items] of groups.entries()) {
      const lines = buildMarkdownLines(items)
      if (lines.length === 0) continue
      const markdown = `>[!summary]-\n>[grid]\n>${lines.join('\n>')}\n>[/grid]`
      const baseName = nameMapping.get(groupName) || sanitizeFileBase(groupName)
      const outFile = path.join(args.output, `${baseName}.md`)
      fs.writeFileSync(outFile, `${markdown}\n`, 'utf8')
      console.log(`Wrote markdown: ${outFile}`)
    }
    return
  }

  const jsonFiles = listGroupJsonFiles(args.input)
  if (jsonFiles.length === 0) {
    console.log(`No group JSON files found in ${args.input}`)
    return
  }

  for (const jsonPath of jsonFiles) {
    let groupJson = null
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8')
      groupJson = JSON.parse(raw)
    } catch (err) {
      console.warn(`Failed to read group JSON: ${jsonPath}`, err)
      continue
    }

    const markdown = buildMarkdown(groupJson)
    if (!markdown) {
      console.warn(`No valid emojis found in ${jsonPath}, skipping markdown.`)
      continue
    }

    const baseName = path.parse(jsonPath).name
    const outFile = path.join(args.output, `${baseName}.md`)
    fs.writeFileSync(outFile, `${markdown}\n`, 'utf8')
    console.log(`Wrote markdown: ${outFile}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
