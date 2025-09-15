#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildType = process.argv[2] || 'build:userscript'

function getUserscriptHeader(minified = false) {
  const version = getPackageVersion()
  const minSuffix = minified ? ' (Minified)' : ''

  return `// ==UserScript==
// @name         Linux do 表情扩展 (Emoji Extension)${minSuffix}
// @namespace    https://github.com/stevessr/bug-v3
// @version      ${version}
// @description  为论坛网站添加表情选择器功能 (Add emoji picker functionality to forum websites)
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @match        http://localhost:5173/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/stevessr/bug-v3
// @supportURL   https://github.com/stevessr/bug-v3/issues
// @downloadURL  https://github.com/stevessr/bug-v3/releases/latest/download/emoji-extension${minified ? '-min' : ''}.user.js
// @updateURL    https://github.com/stevessr/bug-v3/releases/latest/download/emoji-extension${minified ? '-min' : ''}.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

`
}

function getUserscriptFooter() {
  return `
})();`
}

function runESLint(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Running ESLint on ${path.basename(filePath)}...`)

    const configPath = path.resolve(__dirname, '..', '.eslintrc.userscript.js')

    // First try to auto-fix formatting issues
    // Disable `no-empty` for the built file (generated helpers may include empty blocks).
    const fixProcess = spawn(
      'pnpm',
      [
        'exec',
        'eslint',
        filePath,
        '--fix',
        '--no-ignore',
        '--rule',
        'no-empty:0',
        '-c',
        configPath
      ],
      {
        stdio: 'pipe',
        shell: false
      }
    )

    let fixOutput = ''
    let fixError = ''

    fixProcess.stdout.on('data', data => {
      fixOutput += data.toString()
    })

    fixProcess.stderr.on('data', data => {
      fixError += data.toString()
    })

    fixProcess.on('close', fixCode => {
      if (fixCode === 0) {
        console.log(`✅ ESLint auto-fix completed for ${path.basename(filePath)}`)

        // Now run ESLint again to check for remaining issues
        // Run ESLint check but disable `no-empty` so generated code doesn't fail validation.
        const checkProcess = spawn(
          'pnpm',
          ['exec', 'eslint', filePath, '--no-ignore', '--rule', 'no-empty:0', '-c', configPath],
          {
            stdio: 'pipe',
            shell: false
          }
        )

        let checkOutput = ''
        let checkError = ''

        checkProcess.stdout.on('data', data => {
          checkOutput += data.toString()
        })

        checkProcess.stderr.on('data', data => {
          checkError += data.toString()
        })

        checkProcess.on('close', checkCode => {
          if (checkCode === 0) {
            console.log(`✅ ESLint validation passed for ${path.basename(filePath)}`)
            resolve()
          } else {
            console.error(`❌ ESLint validation failed for ${path.basename(filePath)}:`)
            if (checkOutput) console.error(checkOutput)
            if (checkError) console.error(checkError)
            reject(new Error(`ESLint validation failed for ${filePath}`))
          }
        })
      } else {
        console.error(`❌ ESLint auto-fix failed for ${path.basename(filePath)}:`)
        if (fixOutput) console.error(fixOutput)
        if (fixError) console.error(fixError)
        reject(new Error(`ESLint auto-fix failed for ${filePath}`))
      }
    })
  })
}

function getPackageVersion() {
  try {
    const packagePath = path.resolve(__dirname, '..', 'package.json')
    const packageData = fs.readFileSync(packagePath, 'utf8')
    const packageJson = JSON.parse(packageData)
    return packageJson.version || '1.0.0'
  } catch (error) {
    console.warn('Could not read package version, using default')
    console.error(error)
    return '1.0.0'
  }
}

function processUserscript() {
  const isMinified = buildType === 'build:userscript:min'
  const inputDir = isMinified ? 'dist-userscript-min' : 'dist-userscript'
  const outputDir = 'dist'
  const inputFile = path.resolve(__dirname, '..', inputDir, 'userscript.js')
  // Allow variant-specific output filename (e.g. emoji-extension.remote.user.js)
  const variant = process.env.USERSCRIPT_VARIANT || 'default'
  // Treat the internal 'embedded' variant as the default output (no suffix)
  const normalizedVariant = variant === 'embedded' ? 'default' : variant
  const variantSuffix = normalizedVariant && normalizedVariant !== 'default' ? `.${normalizedVariant}` : ''
  const outputFile = path.resolve(
    __dirname,
    '..',
    outputDir,
    `emoji-extension${variantSuffix}${isMinified ? '-min' : ''}.user.js`
  )
  const managerFile = path.resolve(__dirname, '..', 'emoji-manager.html')
  const managerOutput = path.resolve(__dirname, '..', outputDir, 'emoji-manager.html')

  try {
    console.log(`📦 Processing ${isMinified ? 'minified' : 'standard'} userscript...`)

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Read the built userscript
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`)
    }

      let userscriptContent = fs.readFileSync(inputFile, 'utf8')

      // Inline simple top-level import statements that reference local chunks
      // e.g. import "./userscript2.js"; -> prepend the contents of that file and remove the import line
      // This keeps the final userscript as a single flat file (required for userscript packaging)
      const importLineRegex = /^\s*import\s+["'](.+)["'];?\s*$/gm
      const imports = []
      let importMatch
      while ((importMatch = importLineRegex.exec(userscriptContent)) !== null) {
        imports.push(importMatch[1])
      }

      let inlinedPrefix = ''
      for (const importPath of imports) {
        try {
          const importedFile = path.resolve(__dirname, '..', inputDir, importPath)
          if (fs.existsSync(importedFile)) {
            const importedContent = fs.readFileSync(importedFile, 'utf8')
            inlinedPrefix += `\n/* inlined ${path.basename(importedFile)} */\n` + importedContent + '\n'
          } else {
            inlinedPrefix += `\n/* missing import ${importPath} removed */\n`
          }
        } catch (e) {
          inlinedPrefix += `\n/* failed to inline ${importPath} */\n`
        }
      }

      if (imports.length > 0) {
        // Remove all import lines we matched
        userscriptContent = userscriptContent.replace(importLineRegex, '')
        // Prepend the inlined contents so dependencies run first
        userscriptContent = inlinedPrefix + '\n' + userscriptContent
      }

    // Optionally compact the embedded defaultEmojiGroups array into a single line
    const embedOneline = process.env.USERSCRIPT_EMBED_JSON_ONELINE === 'true' || (process.env.USERSCRIPT_VARIANT || '').includes('oneline')
    if (embedOneline) {
      try {
        const varName = 'defaultEmojiGroups'
        const assign = `${varName} = `
        const start = userscriptContent.indexOf(assign)
        const end = start === -1 ? -1 : userscriptContent.indexOf('];', start)
        if (start !== -1 && end !== -1) {
          const raw = userscriptContent.slice(start + assign.length, end + 2) // include closing ']'
          let compact = null
          try {
            // Try to parse as JSON and re-stringify compactly
            const parsed = JSON.parse(raw)
            compact = JSON.stringify(parsed)
          } catch (e) {
            // Fallback: remove newlines and excessive indentation
            compact = raw.replace(/[\r\n]+/g, '').replace(/\s{2,}/g, ' ').trim()
          }

          // Replace the original multi-line array with the compact one-line version
          userscriptContent = userscriptContent.slice(0, start) + assign + compact + ';' + userscriptContent.slice(end + 2)
          console.log('🔧 Compacted embedded defaultEmojiGroups to one line')
        } else {
          console.log('ℹ️ Could not locate defaultEmojiGroups assignment to compact')
        }
      } catch (err) {
        console.warn('⚠️ Failed to compact defaultEmojiGroups:', err && err.message ? err.message : err)
      }
    }

    // Combine header + content + footer
    const header = getUserscriptHeader(isMinified)
    const footer = getUserscriptFooter()
    const finalContent = header + userscriptContent + footer

    // Write the final userscript
    fs.writeFileSync(outputFile, finalContent, 'utf8')

    const stats = fs.statSync(outputFile)
    const sizeKB = (stats.size / 1024).toFixed(2)

    console.log(`✅ Created ${isMinified ? 'minified' : 'standard'} userscript: ${outputFile}`)
    console.log(`📊 File size: ${sizeKB} KB`)

    // Copy emoji manager if it exists (only for standard build to avoid duplication)
    if (!isMinified && fs.existsSync(managerFile)) {
      fs.copyFileSync(managerFile, managerOutput)
      console.log(`📋 Copied emoji manager: ${managerOutput}`)
    }

    // Clean up temporary build directory
    try {
      fs.rmSync(path.resolve(__dirname, '..', inputDir), { recursive: true, force: true })
      console.log(`🧹 Cleaned up temporary directory: ${inputDir}`)
    } catch (cleanupError) {
      console.warn(`⚠️  Could not clean up ${inputDir}:`, cleanupError.message)
    }

    return outputFile
  } catch (error) {
    console.error('❌ Failed to process userscript:', error.message)
    return null
  }
}

async function main() {
  console.log(`🔧 Post-processing userscript build: ${buildType}`)

  try {
    const outputFile = processUserscript()
    if (!outputFile) {
      console.error('❌ Userscript processing failed')
      process.exit(1)
    }

    // Optionally skip ESLint in CI or when building an embedded userscript
    const variant = process.env.USERSCRIPT_VARIANT || 'default'
    const skipEslint = process.env.SKIP_ESLINT === 'true' || variant === 'embedded'

    if (skipEslint) {
      console.log(`⚠️ Skipping ESLint validation for userscript (variant=${variant})`)
      console.log('🎉 Userscript build completed (ESLint skipped).')
      // Attempt to restore original loader. If a backup exists restore it,
      // otherwise write a runtime-fetching loader template to avoid leaving
      // the repo with the embedded static loader.
      try {
        const loaderPath = path.resolve(__dirname, '..', 'src', 'types', 'defaultEmojiGroups.loader.ts')
        const backupPath = loaderPath + '.bak'
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, loaderPath)
          fs.unlinkSync(backupPath)
          console.log(`🔁 Restored original loader from ${backupPath}`)
        } else {
          const runtimeLoader = `import type { DefaultEmojiData, EmojiGroup } from './emoji'

// Runtime loader: fetch runtime JSON from /assets/defaultEmojiGroups.json
// Returns empty defaults if fetch fails.

async function fetchPackagedJSON(): Promise<DefaultEmojiData | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch('/assets/defaultEmojiGroups.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    return data as DefaultEmojiData
  } catch (err) {
    return null
  }
}

export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON()
  if (packaged && Array.isArray(packaged.groups)) return packaged.groups
  return []
}

export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  const packaged = await fetchPackagedJSON()
  if (packaged) return packaged
  return {
    groups: await loadDefaultEmojiGroups(),
    settings: {
      imageScale: 30,
      defaultGroup: 'nachoneko',
      showSearchBar: true,
      gridColumns: 4,
      outputFormat: 'markdown',
      forceMobileMode: false,
      enableLinuxDoInjection: false,
      enableXcomExtraSelectors: true,
      lastModified: Date.now(),
      tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
    }
  } as unknown as DefaultEmojiData
}
`
          fs.writeFileSync(loaderPath, runtimeLoader, 'utf8')
          console.log(`🔁 Wrote runtime loader template to ${loaderPath}`)
        }
      } catch (restoreErr) {
        console.warn('⚠️ Failed to restore or write original loader after userscript build:', restoreErr.message)
      }

      process.exit(0)
    }

    // Run ESLint validation
    await runESLint(outputFile)

    console.log('🎉 Userscript build and validation completed successfully!')
    // Attempt to restore original loader. If a backup exists restore it,
    // otherwise write a runtime-fetching loader template to avoid leaving
    // the repo with the embedded static loader.
    try {
      const loaderPath = path.resolve(__dirname, '..', 'src', 'types', 'defaultEmojiGroups.loader.ts')
      const backupPath = loaderPath + '.bak'
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, loaderPath)
        fs.unlinkSync(backupPath)
        console.log(`🔁 Restored original loader from ${backupPath}`)
      } else {
        const runtimeLoader = `import type { DefaultEmojiData, EmojiGroup } from './emoji'

// Runtime loader: fetch runtime JSON from /assets/defaultEmojiGroups.json
// Returns empty defaults if fetch fails.

async function fetchPackagedJSON(): Promise<DefaultEmojiData | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch('/assets/defaultEmojiGroups.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    return data as DefaultEmojiData
  } catch (err) {
    return null
  }
}

export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON()
  if (packaged && Array.isArray(packaged.groups)) return packaged.groups
  return []
}

export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  const packaged = await fetchPackagedJSON()
  if (packaged) return packaged
  return {
    groups: await loadDefaultEmojiGroups(),
    settings: {
      imageScale: 30,
      defaultGroup: 'nachoneko',
      showSearchBar: true,
      gridColumns: 4,
      outputFormat: 'markdown',
      forceMobileMode: false,
      enableLinuxDoInjection: false,
      enableXcomExtraSelectors: true,
      lastModified: Date.now(),
      tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
    }
  } as unknown as DefaultEmojiData
}
`
        fs.writeFileSync(loaderPath, runtimeLoader, 'utf8')
        console.log(`🔁 Wrote runtime loader template to ${loaderPath}`)
      }
    } catch (restoreErr) {
      console.warn('⚠️ Failed to restore or write original loader after userscript build:', restoreErr.message)
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Build process failed:', error.message)
    process.exit(1)
  }
}

main()
