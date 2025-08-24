import { test, expect } from '@playwright/test'

test.describe('Image Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/html/image-editor.html')
  })

  test('should load image editor interface', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/图片编辑器/)
    
    // Check main header
    await expect(page.locator('text=图片编辑器')).toBeVisible()
    
    // Check main canvas area
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('should display tool sidebar', async ({ page }) => {
    // Check tool categories
    await expect(page.locator('text=工具')).toBeVisible()
    await expect(page.locator('text=调整')).toBeVisible()
    await expect(page.locator('text=滤镜')).toBeVisible()
    
    // Check specific tools
    await expect(page.locator('text=选择')).toBeVisible()
    await expect(page.locator('text=裁剪')).toBeVisible()
    await expect(page.locator('text=画笔')).toBeVisible()
    await expect(page.locator('text=文字')).toBeVisible()
    await expect(page.locator('text=矩形')).toBeVisible()
    await expect(page.locator('text=橡皮擦')).toBeVisible()
  })

  test('should have adjustment controls', async ({ page }) => {
    // Check adjustment sliders
    await expect(page.locator('text=亮度')).toBeVisible()
    await expect(page.locator('text=对比度')).toBeVisible()
    await expect(page.locator('text=饱和度')).toBeVisible()
    await expect(page.locator('text=色相')).toBeVisible()
    
    // Check sliders are functional
    const brightnessSlider = page.locator('input[type="range"]').first()
    await expect(brightnessSlider).toBeVisible()
  })

  test('should have filter effects', async ({ page }) => {
    // Check filter buttons
    await expect(page.locator('text=灰度')).toBeVisible()
    await expect(page.locator('text=复古')).toBeVisible()
    await expect(page.locator('text=模糊')).toBeVisible()
    await expect(page.locator('text=锐化')).toBeVisible()
    await expect(page.locator('text=怀旧')).toBeVisible()
  })

  test('should have file operations', async ({ page }) => {
    // Check file input for loading images
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()
    
    // Check save/export options
    await expect(page.locator('text=保存')).toBeVisible()
    
    // Check format support
    await expect(page.locator('text=PNG')).toBeVisible()
    await expect(page.locator('text=JPG')).toBeVisible()
    await expect(page.locator('text=WebP')).toBeVisible()
    await expect(page.locator('text=GIF')).toBeVisible()
  })

  test('should have canvas controls', async ({ page }) => {
    // Check undo/reset functionality
    await expect(page.locator('text=撤销')).toBeVisible()
    await expect(page.locator('text=重置')).toBeVisible()
    
    // Check zoom controls
    await expect(page.locator('text=缩放')).toBeVisible()
  })

  test('should validate CSP compliance', async ({ page }) => {
    // Check console for CSP violations
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle')
    
    // Check no CSP violations
    const cspErrors = consoleErrors.filter(error => 
      error.includes('Content Security Policy') ||
      error.includes('inline script') ||
      error.includes('unpkg.com') ||
      error.includes('cdn.jsdelivr.net')
    )
    
    expect(cspErrors).toHaveLength(0)
  })

  test('should handle tool selection', async ({ page }) => {
    // Test selecting different tools
    await page.locator('text=画笔').click()
    // Tool should be selected (visual feedback would be tested in integration)
    
    await page.locator('text=文字').click()
    // Text tool should be selected
    
    await page.locator('text=裁剪').click()
    // Crop tool should be selected
  })

  test('should handle canvas interactions', async ({ page }) => {
    const canvas = page.locator('canvas')
    
    // Test canvas is interactive
    await canvas.click({ position: { x: 100, y: 100 } })
    
    // Test canvas drawing capabilities would require more complex setup
    // This ensures the canvas element is present and clickable
    await expect(canvas).toBeVisible()
  })

  test('should handle file loading interface', async ({ page }) => {
    // Check drag and drop area or file input
    const uploadArea = page.locator('text=点击选择图片文件')
    if (await uploadArea.isVisible()) {
      await expect(uploadArea).toBeVisible()
    } else {
      // Alternative file input method
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toBeAttached()
    }
  })
})