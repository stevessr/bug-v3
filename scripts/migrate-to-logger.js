#!/usr/bin/env node

/**
 * Console to Logger Migration Script
 * 自动将 console.* 调用替换为统一的 logger
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// 统计
let stats = {
  filesScanned: 0,
  filesModified: 0,
  consoleCallsReplaced: 0,
  errors: 0
}

/**
 * 从文件路径提取合适的 logger 上下文名称
 */
function getContextName(filePath) {
  const relativePath = path.relative(path.join(__dirname, '..', 'src'), filePath)
  const parts = relativePath.split(path.sep)

  // 提取有意义的上下文
  if (parts.includes('content')) {
    if (parts.includes('discourse')) return 'DiscourseContent'
    if (parts.includes('pixiv')) return 'PixivContent'
    if (parts.includes('bilibili')) return 'BilibiliContent'
    if (parts.includes('reddit')) return 'RedditContent'
    if (parts.includes('x')) return 'XContent'
    if (parts.includes('xhs')) return 'XHSContent'
    return 'Content'
  }
  if (parts.includes('background')) return 'Background'
  if (parts.includes('options')) return 'Options'
  if (parts.includes('popup')) return 'Popup'
  if (parts.includes('stores')) return 'Store'

  // 默认使用文件名
  const filename = path.basename(filePath, path.extname(filePath))
  return filename.charAt(0).toUpperCase() + filename.slice(1)
}

/**
 * 检查文件是否已经导入 logger
 */
function hasLoggerImport(content) {
  return /import.*createLogger.*from.*logger/.test(content)
}

/**
 * 添加 logger 导入
 */
function addLoggerImport(content, filePath) {
  const contextName = getContextName(filePath)

  // 查找最后一个 import 语句
  const importRegex = /^import\s+.*$/gm
  const imports = content.match(importRegex) || []

  if (imports.length === 0) {
    // 没有 import，添加到文件开头
    return `import { createLogger } from '@/utils/logger'\n\nconst log = createLogger('${contextName}')\n\n${content}`
  }

  // 在最后一个 import 后添加
  const lastImport = imports[imports.length - 1]
  const lastImportIndex = content.lastIndexOf(lastImport)
  const insertPos = lastImportIndex + lastImport.length

  const loggerImport = `\nimport { createLogger } from '@/utils/logger'\n\nconst log = createLogger('${contextName}')\n`

  return content.slice(0, insertPos) + loggerImport + content.slice(insertPos)
}

/**
 * 替换 console 调用为 logger
 */
function replaceConsoleCalls(content) {
  let modified = content
  let replacements = 0

  // 匹配模式
  const patterns = [
    // console.log(...) -> log.info(...)
    {
      regex: /console\.log\(/g,
      replacement: 'log.info(',
      level: 'info'
    },
    // console.info(...) -> log.info(...)
    {
      regex: /console\.info\(/g,
      replacement: 'log.info(',
      level: 'info'
    },
    // console.debug(...) -> log.debug(...)
    {
      regex: /console\.debug\(/g,
      replacement: 'log.debug(',
      level: 'debug'
    },
    // console.warn(...) -> log.warn(...)
    {
      regex: /console\.warn\(/g,
      replacement: 'log.warn(',
      level: 'warn'
    },
    // console.error(...) -> log.error(...)
    {
      regex: /console\.error\(/g,
      replacement: 'log.error(',
      level: 'error'
    }
  ]

  patterns.forEach(({ regex, replacement }) => {
    const matches = modified.match(regex)
    if (matches) {
      replacements += matches.length
      modified = modified.replace(regex, replacement)
    }
  })

  return { content: modified, replacements }
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  stats.filesScanned++

  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // 检查是否有 console 调用
    if (!/console\.(log|info|debug|warn|error)\(/.test(content)) {
      if (VERBOSE) console.log(`⏭️  Skipping ${filePath} (no console calls)`)
      return
    }

    let modified = content

    // 添加 logger 导入（如果还没有）
    if (!hasLoggerImport(content)) {
      modified = addLoggerImport(modified, filePath)
    }

    // 替换 console 调用
    const { content: replaced, replacements } = replaceConsoleCalls(modified)
    modified = replaced

    if (replacements > 0) {
      if (DRY_RUN) {
        console.log(`✓ Would modify ${filePath} (${replacements} console calls)`)
      } else {
        fs.writeFileSync(filePath, modified, 'utf-8')
        console.log(`✓ Modified ${filePath} (${replacements} console calls)`)
        stats.filesModified++
      }
      stats.consoleCallsReplaced += replacements
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message)
    stats.errors++
  }
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir, extensions = ['.ts', '.tsx', '.vue']) {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // 跳过 node_modules 和 dist
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scanDirectory(filePath, extensions)
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file)
      if (extensions.includes(ext)) {
        processFile(filePath)
      }
    }
  })
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 Console to Logger Migration Script\n')

  if (DRY_RUN) {
    console.log('🔍 Running in DRY RUN mode (no files will be modified)\n')
  }

  const srcDir = path.join(__dirname, '..', 'src')

  // 只处理 content, background, options
  const targetDirs = ['content', 'background', 'options'].map(d => path.join(srcDir, d))

  targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`📁 Scanning ${path.relative(srcDir, dir)}/\n`)
      scanDirectory(dir)
    }
  })

  // 打印统计
  console.log('\n📊 Migration Statistics:')
  console.log(`   Files scanned: ${stats.filesScanned}`)
  console.log(`   Files modified: ${stats.filesModified}`)
  console.log(`   Console calls replaced: ${stats.consoleCallsReplaced}`)
  console.log(`   Errors: ${stats.errors}`)

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes')
  } else {
    console.log('\n✅ Migration complete!')
    console.log('⚠️  Please run `pnpm type-check` to verify no errors were introduced')
  }
}

main()
