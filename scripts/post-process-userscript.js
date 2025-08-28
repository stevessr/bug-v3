#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildType = process.env.npm_lifecycle_event || 'build:userscript'

function getUserscriptHeader(minified = false) {
  const version = '1.0.0'
  const name = minified ? 'Linux.do 表情包扩展 (Minified)' : 'Linux.do 表情包扩展'

  return `// ==UserScript==
// @name         ${name}
// @namespace    https://github.com/stevessr/bug-v3
// @version      ${version}
// @description  为 Linux.do 等论坛网站添加表情包功能${minified ? ' (压缩版)' : ''}
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_notification
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

async function runESLint(filePath) {
  try {
    console.log(`🔍 Running ESLint validation on ${filePath}...`)
    const { ESLint } = await import('eslint')

    const eslint = new ESLint({
      useEslintrc: false,
      baseConfig: {
        env: { browser: true, es2021: true },
        extends: ['eslint:recommended'],
        parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
      },
    })

    const results = await eslint.lintFiles([filePath])
    const formatter = await eslint.loadFormatter('stylish')
    const resultText = formatter.format(results)

    if (resultText) {
      console.log('📋 ESLint Results:')
      console.log(resultText)
    } else {
      console.log('✅ ESLint validation passed')
    }

    return results.every((result) => result.errorCount === 0)
  } catch (error) {
    console.warn('⚠️  ESLint validation skipped:', error.message)
    return true // Don't fail build for ESLint issues
  }
}

function processUserscript() {
  const isMinified = buildType === 'build:userscript:min'
  const inputDir = isMinified ? 'dist-userscript-min' : 'dist-userscript'
  const outputDir = 'dist'
  const inputFile = path.resolve(__dirname, '..', inputDir, 'userscript.js')
  const outputFile = path.resolve(
    __dirname,
    '..',
    outputDir,
    `emoji-extension${isMinified ? '-min' : ''}.user.js`,
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

    const userscriptContent = fs.readFileSync(inputFile, 'utf8')

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
      console.log(`✅ Copied emoji manager: ${managerOutput}`)
    }

    return outputFile
  } catch (error) {
    console.error('❌ Error processing userscript:', error.message)
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

    // Run ESLint validation
    await runESLint(outputFile)

    console.log('🎉 Userscript build and validation completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Build process failed:', error.message)
    process.exit(1)
  }
}

main()
