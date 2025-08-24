import { test, expect } from '@playwright/test'

test.describe('Tools Tab Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    // Wait for Vue app to initialize
    await page.waitForSelector('#app')
    await page.waitForLoadState('networkidle')
  })

  test('should display tools tab with correct navigation', async ({ page }) => {
    // Check if tools tab exists
    const toolsTab = page.locator('text=小工具')
    await expect(toolsTab).toBeVisible()
    
    // Click on tools tab
    await toolsTab.click()
    
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Verify tools cards are displayed - look for the actual class structure
    const toolCards = page.locator('.bg-white.rounded-lg.border.border-gray-200.p-6')
    await expect(toolCards).toHaveCount(4)
    
    // Check each tool card
    await expect(page.locator('text=AI 图片生成')).toBeVisible()
    await expect(page.locator('text=动图转换器')).toBeVisible()
    await expect(page.locator('text=图片编辑器')).toBeVisible()
    await expect(page.locator('text=表情管理器')).toBeVisible()
  })

  test('should open animation converter in new tab', async ({ context, page }) => {
    // Navigate to tools tab
    await page.locator('text=小工具').click()
    await page.waitForTimeout(2000)
    
    // Click on animation converter
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=动图转换器').click()
    ])
    
    // Wait for new page to load
    await newPage.waitForLoadState('networkidle')
    
    // Verify new page opened with correct URL
    await expect(newPage).toHaveURL(/animation-converter\.html/)
    
    // Verify page title
    await expect(newPage).toHaveTitle(/动图转换器/)
  })

  test('should open image editor in new tab', async ({ context, page }) => {
    await page.locator('text=小工具').click()
    await page.waitForTimeout(2000)
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=图片编辑器').click()
    ])
    
    await newPage.waitForLoadState('networkidle')
    await expect(newPage).toHaveURL(/image-editor\.html/)
    await expect(newPage).toHaveTitle(/图片编辑器/)
  })

  test('should open AI generator in new tab', async ({ context, page }) => {
    await page.locator('text=小工具').click()
    await page.waitForTimeout(2000)
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=AI 图片生成').click()
    ])
    
    await newPage.waitForLoadState('networkidle')
    await expect(newPage).toHaveURL(/image-generator-vue\.html/)
  })

  test('should open emoji manager in new tab', async ({ context, page }) => {
    await page.locator('text=小工具').click()
    await page.waitForTimeout(2000)
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=表情管理器').click()
    ])
    
    await newPage.waitForLoadState('networkidle')
    await expect(newPage).toHaveURL(/emoji-manager\.html/)
    await expect(newPage).toHaveTitle(/表情管理器/)
  })

  test('should display privacy notice', async ({ page }) => {
    await page.locator('text=小工具').click()
    await page.waitForTimeout(2000)
    
    // Check privacy notice is displayed
    await expect(page.locator('text=隐私提醒')).toBeVisible()
    await expect(page.locator('text=所有工具均在本地处理')).toBeVisible()
  })
})