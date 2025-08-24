import { test, expect } from '@playwright/test'

test.describe('Animation Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/animation-converter.html')
  })

  test('should load animation converter interface', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/动画转换器/)
    
    // Check main header
    await expect(page.locator('text=动画转换器')).toBeVisible()
    
    // Check tab navigation
    await expect(page.locator('text=格式转换')).toBeVisible()
    await expect(page.locator('text=帧拆分')).toBeVisible()
    await expect(page.locator('text=帧合并')).toBeVisible()
  })

  test('should display format converter interface', async ({ page }) => {
    // Should be on format converter by default
    await expect(page.locator('text=将 GIF、MP4、WebM 转换为 APNG 或 GIF 格式')).toBeVisible()
    
    // Check file upload area
    await expect(page.locator('text=拖拽文件到此处或点击选择')).toBeVisible()
    await expect(page.locator('text=支持 GIF、MP4、WebM 格式，最大 100MB')).toBeVisible()
    
    // Check settings
    await expect(page.locator('text=输出格式')).toBeVisible()
    await expect(page.locator('text=质量')).toBeVisible()
    await expect(page.locator('text=帧率 (FPS)')).toBeVisible()
    await expect(page.locator('text=输出宽度 (px)')).toBeVisible()
  })

  test('should switch between tabs correctly', async ({ page }) => {
    // Switch to frame splitter
    await page.locator('text=帧拆分').click()
    await expect(page.locator('text=从动画文件中提取单独的帧')).toBeVisible()
    
    // Switch to frame merger
    await page.locator('text=帧合并').click()
    await expect(page.locator('text=将多张图片合并为动画')).toBeVisible()
    
    // Switch back to format converter
    await page.locator('text=格式转换').click()
    await expect(page.locator('text=将 GIF、MP4、WebM 转换为 APNG 或 GIF 格式')).toBeVisible()
  })

  test('should validate FFmpeg loading without CDN dependencies', async ({ page }) => {
    // Check console for CSP violations
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle')
    
    // Check no CDN loading errors
    const cspErrors = consoleErrors.filter(error => 
      error.includes('Content Security Policy') ||
      error.includes('unpkg.com') ||
      error.includes('cdn.jsdelivr.net')
    )
    
    expect(cspErrors).toHaveLength(0)
  })

  test('should have proper file upload functionality', async ({ page }) => {
    // Check file input exists
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()
    
    // Check drag and drop area
    const dropZone = page.locator('.upload-area')
    await expect(dropZone).toBeVisible()
  })

  test('should display conversion settings', async ({ page }) => {
    // Check format selector
    const formatSelect = page.locator('select').first()
    await expect(formatSelect).toBeVisible()
    
    // Check quality selector
    await expect(page.locator('text=中等质量')).toBeVisible()
    
    // Check FPS input
    const fpsInput = page.locator('input#frame-rate')
    await expect(fpsInput).toBeVisible()
    
    // Check width input
    const widthInput = page.locator('input#max-width')
    await expect(widthInput).toBeVisible()
  })

  test('should handle frame splitter interface', async ({ page }) => {
    await page.locator('text=帧拆分').click()
    
    // Check frame splitter specific elements
    await expect(page.locator('text=从动画文件中提取单独的帧')).toBeVisible()
    await expect(page.locator('text=支持 GIF、MP4、WebM、APNG 格式')).toBeVisible()
    
    // Check download options
    await expect(page.locator('text=帧格式')).toBeVisible()
  })

  test('should handle frame merger interface', async ({ page }) => {
    await page.locator('text=帧合并').click()
    
    // Check frame merger specific elements
    await expect(page.locator('text=将多张图片合并为动画')).toBeVisible()
    await expect(page.locator('text=支持 PNG、JPG、WebP 格式，可选择多个文件')).toBeVisible()
    
    // Check multiple file upload
    const fileInput = page.locator('input#merger-files')
    await expect(fileInput).toHaveAttribute('multiple')
  })
})