import { test, expect } from '@playwright/test'

test.describe('External Import Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')

    // Navigate to external import tab
    await page.click('text=外部导入')
    await page.waitForTimeout(1000)
  })

  test('should display external import interface correctly', async ({ page }) => {
    // Check main heading
    await expect(page.getByRole('heading', { name: '外部表情导入' })).toBeVisible()

    // Check all import sections
    await expect(page.getByRole('heading', { name: '导入配置文件' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '导入表情包' })).toBeVisible()
    await expect(page.getByText('从文本导入')).toBeVisible()
  })

  test('should handle configuration file import', async ({ page }) => {
    // Check configuration import section
    await expect(page.locator('text=导入之前导出的完整配置文件')).toBeVisible()

    // Check import button
    const configButton = page.locator('button:has-text("选择配置文件")')
    await expect(configButton).toBeVisible()

    // Click to trigger file input
    await configButton.click()
    // File input should be triggered (can't easily test file selection)
  })

  test('should handle emoji package import', async ({ page }) => {
    // Check emoji import section
    await expect(page.locator('text=导入单个表情包文件')).toBeVisible()

    // Check import button
    const emojiButton = page.locator('button:has-text("选择表情文件")')
    await expect(emojiButton).toBeVisible()

    // Click to trigger file input
    await emojiButton.click()
  })

  test('should handle text import with markdown', async ({ page }) => {
    // Check text import section
    await expect(page.locator('text=从Markdown格式文本导入表情')).toBeVisible()

    // Check textarea
    const textarea = page.locator('textarea[placeholder*="![表情名](表情URL)"]')
    await expect(textarea).toBeVisible()

    // Test input
    const markdownText =
      '![test1](https://example.com/emoji1.gif)\n![test2](https://example.com/emoji2.png)'
    await textarea.fill(markdownText)

    // Check import button
    const importButton = page.locator('button:has-text("导入文本中的表情")')
    await expect(importButton).toBeEnabled()

    // Check group selector
    const groupSelect = page.locator('select').first()
    await expect(groupSelect).toBeVisible()
    await groupSelect.selectOption('')

    // Test import
    await importButton.click()

    // Should show processing (simulated)
    await page.waitForTimeout(2000)
  })

  // Tenor and Waline functionality removed - tests no longer applicable

  test('should validate form inputs properly', async ({ page }) => {
    // Test text import without content
    const textImportButton = page.locator('button:has-text("导入文本中的表情")')
    await expect(textImportButton).toBeDisabled()
  })

  test('should show import progress and results', async ({ page }) => {
    // Simulate import operation
    const textarea = page.locator('textarea[placeholder*="![表情名](表情URL)"]')
    await textarea.fill('![test](https://example.com/emoji.gif)')

    const importButton = page.locator('button:has-text("导入文本中的表情")')
    await importButton.click()

    // Should show progress
    await expect(page.locator('.animate-spin')).toBeVisible()
    await expect(page.getByText('正在解析Markdown文本')).toBeVisible()

    // Wait for completion
    await page.waitForTimeout(3000)

    // Should show results
    await expect(page.getByText('从文本导入成功')).toBeVisible()
    await expect(page.getByText('已导入')).toBeVisible()
  })

  test('should handle import errors gracefully', async ({ page }) => {
    // Simulate error scenario by providing invalid data
    const textarea = page.locator('textarea[placeholder*="![表情名](表情URL)"]')
    await textarea.fill('invalid markdown content without proper format')

    const importButton = page.locator('button:has-text("导入文本中的表情")')
    await importButton.click()

    // Wait for processing
    await page.waitForTimeout(3000)

    // Should handle error appropriately
    // The exact error handling would depend on implementation
  })

  test('should support group selection for imports', async ({ page }) => {
    // Test group selection for text import
    const groupSelect = page.locator('select').first()
    await expect(groupSelect).toBeVisible()

    // Should have options
    await expect(groupSelect.locator('option').first()).toBeVisible()

    // Select existing group if available
    const groupOptions = await groupSelect.locator('option').count()
    if (groupOptions > 1) {
      await groupSelect.selectOption({ index: 1 })
    }
  })

  test('should clear inputs after successful import', async ({ page }) => {
    // Test text import input clearing
    const textarea = page.locator('textarea[placeholder*="![表情名](表情URL)"]')
    await textarea.fill('![test](https://example.com/emoji.gif)')

    const importButton = page.locator('button:has-text("导入文本中的表情")')
    await importButton.click()

    // Wait for completion
    await page.waitForTimeout(3000)

    // Input should be cleared on success
    await expect(textarea).toHaveValue('')
  })

  test('should show detailed progress information', async ({ page }) => {
    // Test progress details during import
    const textarea = page.locator('textarea[placeholder*="![表情名](表情URL)"]')
    await textarea.fill(
      '![emoji1](https://example.com/1.gif)\n![emoji2](https://example.com/2.png)'
    )

    const importButton = page.locator('button:has-text("导入文本中的表情")')
    await importButton.click()

    // Should show step-by-step progress
    await expect(page.getByText('正在解析Markdown文本')).toBeVisible()

    // Wait for different progress stages
    await page.waitForTimeout(1000)

    // Progress should update
    await page.waitForTimeout(2000)

    // Final result should show count
    await expect(page.getByText(/已导入 \d+ 个表情/)).toBeVisible()
  })
})
