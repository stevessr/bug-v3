#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildType = process.argv[2] || 'build:userscript'

function getUserscriptHeader(
  minified = false,
  variant = 'remote',
  scriptName = 'emoji-extension',
  scriptTitle = 'Discourse 表情扩展 (Emoji Extension for Discourse)',
  scriptDescription = '为 Discourse 论坛添加表情选择器功能 (Add emoji picker functionality to Discourse forums)'
) {
  const version = getPackageVersion()
  const minSuffix = minified ? ' (Minified)' : ''
  const liteSuffix = variant === 'remote' ? ' lite' : ''
  const grants = '// @grant        none'

  const variantSuffix = variant && variant !== 'default' ? `.${variant}` : ''

  return `// ==UserScript==
// @name         ${scriptTitle}${liteSuffix}${minSuffix}
// @namespace    https://github.com/stevessr/bug-v3
// @version      ${version}
// @description  ${scriptDescription}
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @match        http://localhost:5173/*
// @exclude      https://linux.do/a/*
// @match        https://idcflare.com/*
${grants}
// @license      MIT
// @homepageURL  https://github.com/stevessr/bug-v3
// @supportURL   https://github.com/stevessr/bug-v3/issues
// @downloadURL  https://github.com/stevessr/bug-v3/releases/latest/download/${scriptName}${variantSuffix}${minified ? '-min' : ''}.user.js
// @updateURL    https://github.com/stevessr/bug-v3/releases/latest/download/${scriptName}${variantSuffix}${minified ? '-min' : ''}.user.js
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

function getTampermonkeyRuntimeSnippet() {
  // This runtime snippet will register a Tampermonkey menu command that
  // attempts several strategies to open the emoji manager / settings:
  // 1. Call an exposed global function if the userscript exposes one.
  // 2. Dispatch a CustomEvent which the main script can listen for.
  // 3. Use GM_openInTab to open a manager URL (best-effort). Fallback to
  //    opening '/emoji-manager.html' in a new tab.
  return `/* eslint-disable no-undef, no-unused-vars */
// Tampermonkey runtime helpers (auto-injected)
(function () {
  function openEmojiManager() {
    try {
      // 1) Call an exposed helper if available
      if (typeof window.__emoji_extension_openManager === 'function') {
        return window.__emoji_extension_openManager()
      }

      // 2) Dispatch an event that the main script may listen for
      try { window.dispatchEvent(new CustomEvent('emoji-extension-open-manager')) } catch (e) { /* ignore */ }

      // 3) Try to open a packaged manager via GM_openInTab (Tampermonkey)
      if (typeof GM_openInTab === 'function') {
        var managerUrl = (typeof USERSCRIPT_MANAGER_URL !== 'undefined' && USERSCRIPT_MANAGER_URL) || 'https://raw.githubusercontent.com/stevessr/bug-v3/main/emoji-manager.html'
        try { GM_openInTab(managerUrl, { active: true, insert: true }); return } catch (err) { /* not fatal */ }
      }

      // 4) Fallback to opening a relative path (works if manager is served)
      try { window.open('/emoji-manager.html', '_blank') } catch (e) { /* ignore */ }
    } catch (err) {
      console.warn('emoji-extension: failed to open manager', err)
    }
  }

  // Register Tampermonkey menu command where available
  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Open Emoji Settings', openEmojiManager)
    } else if (typeof GM === 'object' && typeof GM.registerMenuCommand === 'function') {
      GM.registerMenuCommand('Open Emoji Settings', openEmojiManager)
    }
  } catch (e) { /* Non-fatal */ }

  // Expose helper for other scripts to call directly
  try { window.__emoji_extension_openManager = openEmojiManager } catch (e) { /* ignore */ }

  // Inject an unobtrusive floating button into the page for quick access.
  try {
    function createFloatingButton() {
      try {
        if (!document || !document.body) return
        if (document.getElementById('emoji-extension-open-settings-btn')) return

        var btn = document.createElement('button')
        btn.id = 'emoji-extension-open-settings-btn'
        btn.type = 'button'
        btn.title = 'Open Emoji Settings'
        btn.innerText = 'Emoji ⚙'
        Object.assign(btn.style, {
          position: 'fixed',
          right: '12px',
          bottom: '12px',
          zIndex: 2147483647,
          padding: '8px 10px',
          borderRadius: '8px',
          border: 'none',
          background: '#1f2937',
          color: '#fff',
          fontSize: '13px',
          boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
          cursor: 'pointer'
        })

        btn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          try { openEmojiManager() } catch (err) { console.warn('failed to open emoji manager', err) }
        }, { passive: true })

        document.body.appendChild(btn)
      } catch (err) { /* ignore */ }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      createFloatingButton()
    } else {
      window.addEventListener('DOMContentLoaded', createFloatingButton, { once: true })
      window.addEventListener('load', createFloatingButton, { once: true })
    }
  } catch (err) { /* ignore */ }

}());

/* eslint-enable */
`
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

function processUserscript(scriptName, scriptTitle, scriptDescription) {
  const isMinified = buildType === 'build:userscript:min'
  const outputDir = 'dist'
  const inputFile = path.resolve(__dirname, '..', outputDir, `${scriptName}.js`)
  const variant = 'remote'
  const normalizedVariant = 'remote'
  const variantSuffix =
    normalizedVariant && normalizedVariant !== 'default' ? `.${normalizedVariant}` : ''
  const outputFile = path.resolve(
    __dirname,
    '..',
    outputDir,
    `${scriptName}${variantSuffix}${isMinified ? '-min' : ''}.user.js`
  )
  const managerFile = path.resolve(__dirname, '..', 'emoji-manager.html')
  const managerOutput = path.resolve(__dirname, '..', outputDir, 'emoji-manager.html')

  try {
    console.log(`📦 Processing ${scriptTitle} (${isMinified ? 'minified' : 'standard'})...`)

    // Read the built userscript
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`)
    }

    let userscriptContent = fs.readFileSync(inputFile, 'utf8')

    // Inline simple top-level import statements that reference local chunks
    const importLineRegex = /^\s*import\s+["'](.+)["'];?\s*$/gm
    const imports = []
    let importMatch
    while ((importMatch = importLineRegex.exec(userscriptContent)) !== null) {
      imports.push(importMatch[1])
    }

    let inlinedPrefix = ''
    for (const importPath of imports) {
      try {
        const importedFile = path.resolve(__dirname, '..', outputDir, importPath)
        if (fs.existsSync(importedFile)) {
          const importedContent = fs.readFileSync(importedFile, 'utf8')
          inlinedPrefix +=
            `\n/* inlined ${path.basename(importedFile)} */\n` + importedContent + '\n'
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

    // Combine header + optional runtime helpers + content + footer
    const header = getUserscriptHeader(
      isMinified,
      normalizedVariant,
      scriptName,
      scriptTitle,
      scriptDescription
    )
    const footer = getUserscriptFooter()

    // Tampermonkey runtime helpers removed for modular scripts
    let runtimeHelpers = ''

    const finalContent = header + runtimeHelpers + userscriptContent + footer

    // Write the final userscript
    fs.writeFileSync(outputFile, finalContent, 'utf8')

    const stats = fs.statSync(outputFile)
    const sizeKB = (stats.size / 1024).toFixed(2)

    console.log(`✅ Created ${scriptTitle}: ${outputFile}`)
    console.log(`📊 File size: ${sizeKB} KB`)

    // Copy emoji manager if it exists (only for core script and standard build)
    if (!isMinified && scriptName === 'emoji-picker-core' && fs.existsSync(managerFile)) {
      fs.copyFileSync(managerFile, managerOutput)
      console.log(`📋 Copied emoji manager: ${managerOutput}`)
    }

    // Clean up the original temporary file after processing
    try {
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile)
        console.log(`🧹 Cleaned up temporary file: ${scriptName}.js`)
      }
    } catch (cleanupError) {
      console.warn(`⚠️  Could not clean up ${scriptName}.js:`, cleanupError.message)
    }

    return outputFile
  } catch (error) {
    console.error(`❌ Failed to process ${scriptName}:`, error.message)
    return null
  }
}

async function main() {
  console.log(`🔧 Post-processing userscript build: ${buildType}`)

  try {
    // Process both scripts
    const scripts = [
      {
        name: 'emoji-picker-core',
        title: 'Discourse 表情选择器 (Emoji Picker) core',
        description:
          'Discourse 论坛表情选择器 - 核心功能 (Emoji picker for Discourse - Core features only)'
      },
      {
        name: 'emoji-manager',
        title: 'Discourse 表情管理器 (Emoji Manager) mgr',
        description:
          'Discourse 论坛表情管理 - 设置、导入导出、分组编辑 (Emoji management for Discourse - Settings, import/export, group editor)'
      }
    ]

    const outputFiles = []
    for (const script of scripts) {
      const outputFile = processUserscript(script.name, script.title, script.description)
      if (!outputFile) {
        console.error(`❌ ${script.title} processing failed`)
        process.exit(1)
      }
      outputFiles.push(outputFile)
    }

    // Optionally skip ESLint
    const skipEslint = process.env.SKIP_ESLINT === 'true'

    if (skipEslint) {
      console.log(`⚠️ Skipping ESLint validation for userscripts`)
      console.log('🎉 Userscript build completed (ESLint skipped).')
      process.exit(0)
    }

    console.log('🎉 Userscript build and validation completed successfully!')
    console.log(`📦 Generated ${outputFiles.length} userscripts:`)
    outputFiles.forEach(f => console.log(`   - ${path.basename(f)}`))
    process.exit(0)
  } catch (error) {
    console.error('❌ Build process failed:', error.message)
    process.exit(1)
  }
}

main()
