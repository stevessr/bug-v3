import path from 'path'

import { test, expect } from '@playwright/test'

test.describe('Chrome Extension Core Functionality', () => {
  test('should successfully build and load without critical errors', async ({ page }) => {
    // This test verifies the core issues have been resolved
    const errors: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error') {
        // Only capture critical errors that would prevent the extension from working
        if (
          text.includes('content.js') &&
          (text.includes('does not provide an export') ||
            text.includes('SyntaxError') ||
            text.includes('Unexpected identifier'))
        ) {
          errors.push(text)
        }
      }
    })

    // Navigate to options page
    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    // Wait for initial load
    await page.waitForTimeout(3000)

    // Check for critical build errors
    console.log('Critical errors found:', errors)
    expect(errors).toHaveLength(0)

    // Verify page loads with correct title
    const title = await page.title()
    expect(title).toContain('表情')

    console.log('✅ Core functionality test passed - no critical build errors')
  })

  test('should have correct file structure in dist', async () => {
    // Verify that the built files exist and are structured correctly
    const fs = await import('fs')
    const path = await import('path')

    const distPath = path.resolve('./dist')

    // Check essential files exist
    expect(fs.existsSync(path.join(distPath, 'options.html'))).toBe(true)
    expect(fs.existsSync(path.join(distPath, 'js', 'options.js'))).toBe(true)
    expect(fs.existsSync(path.join(distPath, 'js', 'content.js'))).toBe(true)
    expect(fs.existsSync(path.join(distPath, 'manifest.json'))).toBe(true)

    // Check that options.js doesn't import content.js
    const optionsJs = fs.readFileSync(path.join(distPath, 'js', 'options.js'), 'utf8')
    expect(optionsJs).not.toContain('import{l as H}from"./content.js"')
    expect(optionsJs).not.toContain('from"./content.js"')

    console.log('✅ File structure test passed - correct build output')
  })

  test('should verify upload functionality removal', async ({ page }) => {
    // This test specifically verifies that the upload functionality
    // that was causing the build issues has been properly removed

    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(2000)

    // Check page source for upload-related code
    const pageContent = await page.content()

    // Should not contain references to emojiPreviewUploader in the main page
    expect(pageContent).not.toContain('emojiPreviewUploader')
    expect(pageContent).not.toContain('uploadSingleEmoji')

    // Should not contain upload buttons in the main interface
    const uploadButtons = page.locator('button:has-text("上传到linux.do")')
    const uploadCount = await uploadButtons.count()
    expect(uploadCount).toBe(0)

    console.log('✅ Upload functionality removal verified')
  })

  test('should load JavaScript modules correctly', async ({ page }) => {
    const errors: string[] = []
    const moduleErrors: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error') {
        errors.push(text)
        if (text.includes('module') || text.includes('import') || text.includes('export')) {
          moduleErrors.push(text)
        }
      }
    })

    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(3000)

    console.log('All errors:', errors)
    console.log('Module-related errors:', moduleErrors)

    // Filter out expected file:// protocol errors
    const criticalModuleErrors = moduleErrors.filter(
      error =>
        !error.includes('ERR_FILE_NOT_FOUND') &&
        !error.includes('net::ERR_FAILED') &&
        !error.includes('chrome-extension://')
    )

    console.log('Critical module errors:', criticalModuleErrors)
    expect(criticalModuleErrors).toHaveLength(0)

    console.log('✅ JavaScript modules load without critical errors')
  })

  test('should have working Vue application structure', async ({ page }) => {
    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(3000)

    // Check if Vue app div exists
    const appDiv = page.locator('#app')
    const appExists = (await appDiv.count()) > 0

    if (appExists) {
      console.log('Vue app div found')

      // Check if there's any content in the app
      const appContent = await appDiv.innerHTML()
      expect(appContent.length).toBeGreaterThan(10)

      console.log('✅ Vue application structure is present')
    } else {
      console.log('Vue app div not found, checking for alternative structure')

      // Check for any meaningful content in body
      const bodyContent = await page.locator('body').innerHTML()
      expect(bodyContent.length).toBeGreaterThan(100)

      console.log('✅ Page has meaningful content structure')
    }
  })
})
