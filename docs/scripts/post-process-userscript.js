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
// @name         表情扩展 (Emoji Extension)${minSuffix}
// @namespace    https://github.com/stevessr/bug-v3
// @version      ${version}
// @description  为论坛网站添加表情选择器功能 (Add emoji picker functionality to forum websites)
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
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
    const fixProcess = spawn(
      'npx',
      ['eslint', filePath, '--fix', '--no-ignore', '-c', configPath],
      {
        stdio: 'pipe',
        shell: true
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
        const checkProcess = spawn('npx', ['eslint', filePath, '--no-ignore', '-c', configPath], {
          stdio: 'pipe',
          shell: true
        })

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
  const outputFile = path.resolve(
    __dirname,
    '..',
    outputDir,
    `emoji-extension${isMinified ? '-min' : ''}.user.js`
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
