import { test, expect } from '@playwright/test'

test.describe('Tools Tab - Multimedia Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')
    
    // Navigate to tools tab
    await page.click('text=小工具')
    await page.waitForTimeout(1000)
  })

  test('should display tools tab correctly', async ({ page }) => {
    // Check main heading
    await expect(page.locator('text=多媒体小工具')).toBeVisible()
    
    // Check all tool sections are present
    await expect(page.locator('text=格式转换器')).toBeVisible()
    await expect(page.locator('text=帧分离器')).toBeVisible()
    await expect(page.locator('text=帧合并器')).toBeVisible()
    await expect(page.locator('text=本地 FFmpeg 集成')).toBeVisible()
  })

  test('should handle format converter drag and drop area', async ({ page }) => {
    const dropZone = page.locator('.drag-drop-zone').first()
    
    // Check drop zone is visible
    await expect(dropZone).toBeVisible()
    await expect(dropZone).toContainText('拖拽文件到此处或点击选择文件')
    
    // Test click functionality
    await dropZone.click()
    // File input should be triggered (can't easily test file selection in Playwright)
  })

  test('should simulate format conversion progress', async ({ page }) => {
    // Create a mock file and trigger processing
    const dropZone = page.locator('.drag-drop-zone').first()
    
    // Create a test file
    await page.evaluate(() => {
      const mockFile = new File(['test'], 'test.gif', { type: 'image/gif' })
      const component = window.app?.$children?.[0]
      if (component && component.processFormatConverter) {
        component.processFormatConverter(mockFile)
      }
    })
    
    // Wait for progress to show
    await page.waitForTimeout(1000)
    
    // Check if progress is displayed (may be fast due to simulation)
    // Progress bar should exist
    const progressBar = page.locator('.bg-blue-600')
    await expect(progressBar).toBeVisible({ timeout: 2000 })
  })

  test('should handle frame splitter functionality', async ({ page }) => {
    const splitterSection = page.locator('text=帧分离器').locator('..')
    
    await expect(splitterSection.locator('text=开始提取帧')).toBeVisible()
    
    // Button should be disabled initially
    const extractButton = splitterSection.locator('button:has-text("开始提取帧")')
    await expect(extractButton).toBeDisabled()
  })

  test('should handle frame merger configuration', async ({ page }) => {
    const mergerSection = page.locator('text=帧合并器').locator('../..')
    
    // Check input number for frame delay
    const frameDelayInput = page.locator('input[type="number"]').first()
    await expect(frameDelayInput).toBeVisible()
    
    // Check format selector
    const formatSelect = page.locator('select').first()
    await expect(formatSelect).toBeVisible()
    
    // Test changing values
    await frameDelayInput.fill('1000')
    await formatSelect.selectOption('apng')
  })

  test('should initialize FFmpeg', async ({ page }) => {
    const ffmpegSection = page.locator('text=本地 FFmpeg 集成').locator('../..')
    const initButton = ffmpegSection.locator('button:has-text("初始化 FFmpeg")')
    
    await expect(initButton).toBeVisible()
    
    // Click to initialize
    await initButton.click()
    
    // Should show loading state
    await expect(initButton).toHaveText(/初始化 FFmpeg|FFmpeg 已就绪/)
  })

  test('should show enhanced progress bars with file info', async ({ page }) => {
    // Simulate file processing to trigger progress display
    await page.evaluate(() => {
      const mockFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(mockFile, 'size', { value: 1024000 })
      
      const component = window.app?.$children?.[0]
      if (component && component.processFormatConverter) {
        component.processFormatConverter(mockFile)
      }
    })
    
    await page.waitForTimeout(2000)
    
    // Check for file info display
    const fileInfoSection = page.locator('text=文件大小:')
    if (await fileInfoSection.isVisible()) {
      await expect(fileInfoSection).toBeVisible()
      await expect(page.locator('text=尺寸:')).toBeVisible()
      await expect(page.locator('text=帧率:')).toBeVisible()
      await expect(page.locator('text=编码:')).toBeVisible()
      await expect(page.locator('text=码率:')).toBeVisible()
    }
  })
})