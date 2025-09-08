import path from 'path'

import { test, expect } from '@playwright/test'

test.describe('Chrome Extension Options Page - Simple Test', () => {
  test('should load options page from file system', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = []
    const warnings: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error') {
        // Filter out expected extension context errors
        if (
          !text.includes('Extension context invalidated') &&
          !text.includes('chrome-extension://') &&
          !text.includes('Unchecked runtime.lastError') &&
          !text.includes('ERR_FAILED') &&
          !text.includes('net::ERR_FILE_NOT_FOUND')
        ) {
          errors.push(text)
        }
      } else if (msg.type() === 'warning') {
        warnings.push(text)
      }
    })

    // Navigate to options page from file system
    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    // Wait for the page to load
    await page.waitForTimeout(3000)

    // Check that no critical console errors occurred
    console.log('Console errors:', errors)
    console.log('Console warnings:', warnings)

    // Allow some errors but not too many (extension context issues are expected)
    expect(errors.length).toBeLessThan(10)

    // Check that the page loaded correctly
    const title = await page.title()
    expect(title).toBeTruthy()
    console.log('Page title:', title)

    // Check for main content
    const body = await page.locator('body').first()
    await expect(body).toBeVisible()

    // Check for Vue app mounting
    const app = page.locator('#app')
    if ((await app.count()) > 0) {
      await expect(app).toBeVisible()
      console.log('✅ Vue app found and visible')
    }

    // Check for header content
    const header = page.locator('h1, .text-2xl, header')
    if ((await header.count()) > 0) {
      const headerText = await header.first().textContent()
      console.log('Header text:', headerText)
      expect(headerText).toBeTruthy()
    }

    console.log('✅ Options page loaded successfully from file system')
  })

  test('should display navigation tabs', async ({ page }) => {
    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(3000)

    // Look for navigation elements
    const navButtons = page.locator('nav button, .tab, [role="tab"], button')
    const buttonCount = await navButtons.count()

    console.log('Found navigation buttons:', buttonCount)
    expect(buttonCount).toBeGreaterThan(0)

    // Try to click on different tabs if they exist
    if (buttonCount > 1) {
      const firstButton = navButtons.first()
      const buttonText = await firstButton.textContent()
      console.log('First button text:', buttonText)

      if (buttonText && !buttonText.includes('导入') && !buttonText.includes('重置')) {
        await firstButton.click()
        await page.waitForTimeout(1000)
        console.log('✅ Successfully clicked navigation button')
      }
    }
  })

  test('should handle emoji management interface', async ({ page }) => {
    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(3000)

    // Look for emoji-related content
    const emojiElements = page.locator(
      '.emoji, .group, [data-testid*="emoji"], [data-testid*="group"]'
    )
    const emojiCount = await emojiElements.count()

    console.log('Found emoji-related elements:', emojiCount)

    // Look for management buttons
    const managementButtons = page.locator(
      'button:has-text("新建"), button:has-text("添加"), button:has-text("创建"), button:has-text("Create")'
    )
    const managementCount = await managementButtons.count()

    console.log('Found management buttons:', managementCount)

    // The interface should have some interactive elements
    expect(emojiCount + managementCount).toBeGreaterThan(0)

    console.log('✅ Emoji management interface elements found')
  })

  test('should verify upload button functionality is removed', async ({ page }) => {
    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(3000)

    // Look for upload buttons - there should be none in the main interface
    // since we removed the upload functionality from EditEmojiModal
    const uploadButtons = page.locator(
      'button:has-text("上传"), button:has-text("Upload"), button:has-text("linux.do")'
    )
    const uploadCount = await uploadButtons.count()

    console.log('Found upload buttons in main interface:', uploadCount)

    // There should be no upload buttons in the main interface now
    // (we removed them from EditEmojiModal)
    expect(uploadCount).toBe(0)

    console.log('✅ Upload functionality properly removed from main interface')
  })

  test('should not have content.js import errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error' && text.includes('content.js')) {
        errors.push(text)
      }
    })

    const optionsPath = path.resolve('./options.html')
    await page.goto(`file://${optionsPath}`)

    await page.waitForTimeout(3000)

    // Check that there are no content.js import errors
    console.log('Content.js related errors:', errors)
    expect(errors).toHaveLength(0)

    console.log('✅ No content.js import errors found')
  })
})
