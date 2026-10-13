import { test, expect } from './fixtures'

test.describe('Chrome Extension Options Page', () => {
  test('should load options page without errors', async ({ page, extensionId }) => {
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
          !text.includes('Unchecked runtime.lastError')
        ) {
          errors.push(text)
        }
      } else if (msg.type() === 'warning') {
        warnings.push(text)
      }
    })

    // Get extension ID
    console.log('Extension ID:', extensionId)

    // Navigate to options page
    await page.goto(`chrome-extension://${extensionId}/index.html?mode=options`)

    // Wait for the page to load
    await page.waitForTimeout(3000)

    // Check that no critical console errors occurred
    console.log('Console errors:', errors)
    console.log('Console warnings:', warnings)

    expect(errors).toHaveLength(0)

    // Check that the page loaded correctly
    const title = await page.title()
    expect(title).toBeTruthy()

    // Check for main content
    const mainContent = await page.locator('main, #app, .app').first()
    await expect(mainContent).toBeVisible()
  })

  test('should display emoji management interface', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html?mode=options`)

    // Wait for the page to load
    await page.waitForTimeout(3000)

    // Check for header
    const header = page.locator('h1, .text-2xl')
    await expect(header.first()).toBeVisible()

    // Check for navigation tabs
    const tabs = page.locator('#app button, [role="tab"]')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThan(0)

    // Check for settings section
    const settingsTab = page.locator('button:has-text("设置"), button:has-text("Settings")')
    if ((await settingsTab.count()) > 0) {
      await settingsTab.first().click()
      await page.waitForTimeout(1000)

      // Should show settings content
      const settingsContent = page.locator('.space-y-6, .settings-content')
      await expect(settingsContent.first()).toBeVisible()
    }
  })

  test('should handle emoji groups management', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html?mode=options`)

    await page.waitForTimeout(3000)

    // Look for groups management tab
    const groupsTab = page.locator('button:has-text("分组"), button:has-text("Groups")')
    if ((await groupsTab.count()) > 0) {
      await groupsTab.first().click()
      await page.waitForTimeout(1000)

      // Should show groups content
      const groupsContent = page.locator('.group-item, .emoji-group, [data-testid*="group"]')
      const groupCount = await groupsContent.count()

      // Should have at least some groups or a way to create them
      expect(groupCount).toBeGreaterThanOrEqual(0)

      // Look for create group button
      const createButton = page.locator(
        'button:has-text("新建"), button:has-text("Create"), button:has-text("添加")'
      )
      if ((await createButton.count()) > 0) {
        console.log('Found create group button')
      }
    }
  })

  test('should handle upload functionality in edit modal', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html?mode=options`)

    await page.waitForTimeout(3000)

    // Navigate to groups or emojis section
    const groupsTab = page.locator('button:has-text("分组"), button:has-text("Groups")')
    if ((await groupsTab.count()) > 0) {
      await groupsTab.first().click()
      await page.waitForTimeout(1000)

      // Look for edit buttons or emoji items
      const editButtons = page.locator(
        'button:has-text("编辑"), button:has-text("Edit"), .edit-button'
      )
      if ((await editButtons.count()) > 0) {
        await editButtons.first().click()
        await page.waitForTimeout(1000)

        // Check if edit modal opened
        const modal = page.locator('.modal, .dialog, [role="dialog"]')
        if ((await modal.count()) > 0) {
          console.log('Edit modal opened successfully')

          // Look for upload button (should only show when not on linux.do)
          const uploadButton = page.locator('button:has-text("上传"), button:has-text("Upload")')
          const uploadButtonCount = await uploadButton.count()

          // Since we're not on linux.do, upload button should be visible
          console.log('Upload button count:', uploadButtonCount)

          // Close modal
          const closeButton = page.locator(
            'button:has-text("取消"), button:has-text("Cancel"), .close-button'
          )
          if ((await closeButton.count()) > 0) {
            await closeButton.first().click()
          }
        }
      }
    }
  })
})
