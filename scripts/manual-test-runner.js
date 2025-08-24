#!/usr/bin/env node
/**
 * Manual test runner for verifying build integrity
 * Since Playwright browsers can't be installed in this environment,
 * this script provides alternative testing methods
 */

import fs from 'fs'
import path from 'path'

const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0
}

function log(message) {
  console.log(`[TEST] ${message}`)
}

function pass(testName) {
  log(`✅ PASS: ${testName}`)
  testResults.passed++
}

function fail(testName, error) {
  log(`❌ FAIL: ${testName} - ${error}`)
  testResults.failed++
}

function skip(testName, reason) {
  log(`⏸️  SKIP: ${testName} - ${reason}`)
  testResults.skipped++
}

// Example usage of skip function for demonstration
if (process.env.NODE_ENV === 'test') {
  skip('example-test', 'Not implemented yet')
}

async function verifyBuildOutput() {
  log('Testing build output verification...')

  try {
    // Check if dist directory exists
    if (!fs.existsSync('dist')) {
      fail('Build Output', 'dist directory not found')
      return
    }

    // Check for essential HTML files
    const requiredFiles = ['options.html', 'popup.html', 'emoji-manager.html']
    for (const file of requiredFiles) {
      const filePath = path.join('dist', file)
      if (!fs.existsSync(filePath)) {
        fail('Build Output', `Required file ${file} not found`)
        return
      }
    }

    // Check for JS files
    const jsDir = path.join('dist', 'js')
    if (!fs.existsSync(jsDir)) {
      fail('Build Output', 'js directory not found')
      return
    }

    const requiredJsFiles = ['options.js', 'popup.js', 'background.js', 'content.js']
    for (const file of requiredJsFiles) {
      const filePath = path.join(jsDir, file)
      if (!fs.existsSync(filePath)) {
        fail('Build Output', `Required JS file ${file} not found`)
        return
      }
    }

    pass('Build Output Verification')
  } catch (error) {
    fail('Build Output', error.message)
  }
}

async function verifyUserscriptBuild() {
  log('Testing userscript build verification...')

  try {
    // Check if userscript file exists
    const userscriptPath = path.join('dist', 'emoji-extension.user.js')
    if (!fs.existsSync(userscriptPath)) {
      fail('Userscript Build', 'emoji-extension.user.js not found')
      return
    }

    // Check file size (should be reasonable)
    const stats = fs.statSync(userscriptPath)
    if (stats.size < 1000) {
      fail('Userscript Build', 'Userscript file too small (< 1KB)')
      return
    }

    if (stats.size > 1000000) {
      fail('Userscript Build', 'Userscript file too large (> 1MB)')
      return
    }

    // Check file content
    const content = fs.readFileSync(userscriptPath, 'utf8')

    // Should contain userscript headers
    if (!content.includes('// ==UserScript==')) {
      fail('Userscript Build', 'Missing userscript header')
      return
    }

    if (!content.includes('// ==/UserScript==')) {
      fail('Userscript Build', 'Missing userscript footer')
      return
    }

    // Should contain main functionality
    if (!content.includes('表情扩展') && !content.includes('emoji')) {
      fail('Userscript Build', 'Missing expected content')
      return
    }

    pass('Userscript Build Verification')
  } catch (error) {
    fail('Userscript Build', error.message)
  }
}

async function verifyComponentFiles() {
  log('Testing component files verification...')

  try {
    const componentFiles = [
      'src/options/components/ToolsTab.vue',
      'src/options/components/ImageEditorTab.vue',
      'src/options/components/AIGeneratorTab.vue',
      'src/options/components/EmojiNamingTab.vue',
      'src/options/components/ExternalImportTab.vue'
    ]

    for (const file of componentFiles) {
      if (!fs.existsSync(file)) {
        fail('Component Files', `Component file ${file} not found`)
        return
      }

      // Check file size
      const stats = fs.statSync(file)
      if (stats.size < 100) {
        fail('Component Files', `Component file ${file} too small`)
        return
      }

      // Check basic Vue structure
      const content = fs.readFileSync(file, 'utf8')
      if (!content.includes('<template>') || !content.includes('<script')) {
        fail('Component Files', `Component file ${file} missing Vue structure`)
        return
      }
    }

    pass('Component Files Verification')
  } catch (error) {
    fail('Component Files', error.message)
  }
}

async function verifyProjectStructure() {
  log('Testing project structure verification...')

  try {
    // Check tampermonkey directory
    if (!fs.existsSync('scripts/tampermonkey')) {
      fail('Project Structure', 'scripts/tampermonkey directory not found')
      return
    }

    // Check HTML files moved to src/html
    if (!fs.existsSync('src/html')) {
      fail('Project Structure', 'src/html directory not found')
      return
    }

    const htmlFiles = ['options.html', 'popup.html', 'emoji-manager.html']
    for (const file of htmlFiles) {
      if (!fs.existsSync(path.join('src/html', file))) {
        fail('Project Structure', `HTML file src/html/${file} not found`)
        return
      }
    }

    // Check that HTML files are NOT in root anymore
    for (const file of htmlFiles) {
      if (fs.existsSync(file)) {
        fail('Project Structure', `HTML file ${file} still in root directory`)
        return
      }
    }

    // Check tampermonkey frontend
    if (!fs.existsSync('scripts/tampermonkey/frontend/tampermonkey-manager.html')) {
      fail('Project Structure', 'Tampermonkey frontend not found')
      return
    }

    pass('Project Structure Verification')
  } catch (error) {
    fail('Project Structure', error.message)
  }
}

async function verifyTestFiles() {
  log('Testing test files verification...')

  try {
    const testFiles = [
      'scripts/tests/tools-tab.spec.ts',
      'scripts/tests/image-editor.spec.ts',
      'scripts/tests/ai-generator.spec.ts',
      'scripts/tests/emoji-renaming.spec.ts',
      'scripts/tests/external-import.spec.ts',
      'scripts/tests/integration.spec.ts'
    ]

    for (const file of testFiles) {
      if (!fs.existsSync(file)) {
        fail('Test Files', `Test file ${file} not found`)
        return
      }

      // Check file content
      const content = fs.readFileSync(file, 'utf8')
      if (!content.includes('test.describe') || !content.includes('test(')) {
        fail('Test Files', `Test file ${file} missing test structure`)
        return
      }
    }

    pass('Test Files Verification')
  } catch (error) {
    fail('Test Files', error.message)
  }
}

async function runAllTests() {
  log('🚀 Starting manual verification tests...')
  log('')

  await verifyBuildOutput()
  await verifyUserscriptBuild()
  await verifyComponentFiles()
  await verifyProjectStructure()
  await verifyTestFiles()

  log('')
  log('📊 Test Results:')
  log(`✅ Passed: ${testResults.passed}`)
  log(`❌ Failed: ${testResults.failed}`)
  log(`⏸️  Skipped: ${testResults.skipped}`)
  log(`📈 Total: ${testResults.passed + testResults.failed + testResults.skipped}`)

  if (testResults.failed > 0) {
    log('')
    log('❌ Some tests failed. Please check the output above.')
    process.exit(1)
  } else {
    log('')
    log('✅ All tests passed! Build integrity verified.')
    process.exit(0)
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Test runner failed:', error)
  process.exit(1)
})
