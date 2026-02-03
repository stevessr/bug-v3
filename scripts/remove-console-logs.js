#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Directory to process
const srcDir = path.join(__dirname, '..', 'src')

// Pattern to match console.log statements
const consoleLogPatterns = [
  { pattern: /console\.log\([^)]*\);?/g, replacement: '// REMOVED: console.log(...)' },
  { pattern: /console\.warn\([^)]*\);?/g, replacement: '// REMOVED: console.warn(...)' },
  { pattern: /console\.error\([^)]*\);?/g, replacement: '// REMOVED: console.error(...)' },
  { pattern: /console\.info\([^)]*\);?/g, replacement: '// REMOVED: console.info(...)' },
  { pattern: /console\.debug\([^)]*\);?/g, replacement: '// REMOVED: console.debug(...)' },
  { pattern: /console\.trace\([^)]*\);?/g, replacement: '// REMOVED: console.trace(...)' }
]

// Files to exclude (like .vue files where we need to be more careful)
const excludedExtensions = ['.vue'] // Will handle Vue files separately to preserve template structure

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath)
  return !excludedExtensions.includes(ext) && ['.ts', '.js', '.tsx', '.jsx'].includes(ext)
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  let updatedContent = content

  let changesMade = false

  for (const { pattern, replacement } of consoleLogPatterns) {
    if (updatedContent.match(pattern)) {
      const originalLength = updatedContent.length
      updatedContent = updatedContent.replace(pattern, replacement)
      const newLength = updatedContent.length

      // Only count as change if we actually replaced something
      if (originalLength !== newLength) {
        changesMade = true
      }
    }
  }

  if (changesMade) {
    fs.writeFileSync(filePath, updatedContent, 'utf8')
    console.log(`Updated: ${filePath}`)
    return true
  }

  return false
}

function processVueFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  let updatedContent = content

  let changesMade = false

  // For Vue files, process script sections
  const scriptRegex = /(<script[^>]*>)([\s\S]*?)(<\/script>)/g
  let match

  while ((match = scriptRegex.exec(content)) !== null) {
    const fullMatch = match[0]
    const beforeScript = match[1]
    const scriptContent = match[2]
    const afterScript = match[3]

    let updatedScript = scriptContent
    let scriptHasChanges = false

    for (const { pattern, replacement } of consoleLogPatterns) {
      if (updatedScript.match(pattern)) {
        updatedScript = updatedScript.replace(pattern, replacement)
        scriptHasChanges = true
      }
    }

    if (scriptHasChanges) {
      const newScriptBlock = beforeScript + updatedScript + afterScript
      updatedContent = updatedContent.replace(fullMatch, newScriptBlock)
      changesMade = true
    }
  }

  if (changesMade) {
    fs.writeFileSync(filePath, updatedContent, 'utf8')
    console.log(`Updated Vue: ${filePath}`)
    return true
  }

  return false
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir)

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      scanDirectory(fullPath)
    } else if (path.extname(fullPath) === '.vue') {
      processVueFile(fullPath)
    } else if (shouldProcessFile(fullPath)) {
      processFile(fullPath)
    }
  }
}

console.log('Starting console.log removal process...')
console.log(`Processing directory: ${srcDir}`)

try {
  scanDirectory(srcDir)
  console.log('Console.log removal process completed.')
} catch (error) {
  console.error('Error during console.log removal:', error)
  process.exit(1)
}
