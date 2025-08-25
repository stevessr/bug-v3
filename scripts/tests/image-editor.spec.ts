import { test, expect } from '@playwright/test'

test.describe('Image Editor Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')

    // Navigate to image editor tab
    await page.click('text=图像编辑器')
    await page.waitForTimeout(1000)
  })

  test('should display image editor correctly', async ({ page }) => {
    // Check main heading
    await expect(page.locator('text=专业图像编辑器')).toBeVisible()

    // Check upload area is shown initially
    await expect(page.locator('text=拖拽图像到此处或点击选择')).toBeVisible()

    // Check supported formats message
    await expect(page.locator('text=支持: PNG, JPG, WebP, GIF')).toBeVisible()
  })

  test('should show editor interface after image upload simulation', async ({ page }) => {
    // Simulate image upload
    await page.evaluate(() => {
      // Create a mock image
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'red'
        ctx.fillRect(0, 0, 800, 600)
      }

      const dataUrl = canvas.toDataURL()
      const img = new Image()
      img.onload = () => {
        // Simulate component state update
        const component = window.app?.$children?.[0]
        if (component) {
          component.currentImage = img
          component.canvasWidth = 800
          component.canvasHeight = 600
        }
      }
      img.src = dataUrl
    })

    await page.waitForTimeout(2000)

    // Check if editor interface elements are visible
    const editorInterface = page.locator('text=图像编辑器').locator('../../../..')

    // Should have tools
    await expect(editorInterface.locator('text=选择')).toBeVisible()
    await expect(editorInterface.locator('text=画笔')).toBeVisible()
    await expect(editorInterface.locator('text=文本')).toBeVisible()
    await expect(editorInterface.locator('text=橡皮擦')).toBeVisible()

    // Should have adjustment controls
    await expect(editorInterface.locator('text=实时调整')).toBeVisible()
    await expect(editorInterface.locator('text=亮度')).toBeVisible()
    await expect(editorInterface.locator('text=对比度')).toBeVisible()
    await expect(editorInterface.locator('text=饱和度')).toBeVisible()
    await expect(editorInterface.locator('text=色相')).toBeVisible()
  })

  test('should display all editing tools', async ({ page }) => {
    // Check if tools list is comprehensive
    const expectedTools = ['选择', '裁剪', '画笔', '文本', '矩形', '圆形', '橡皮擦']

    for (const tool of expectedTools) {
      await expect(page.locator(`text=${tool}`)).toBeVisible()
    }
  })

  test('should have filter effects available', async ({ page }) => {
    // Simulate having an image loaded first
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component) {
        component.currentImage = { width: 800, height: 600 }
      }
    })

    await page.waitForTimeout(1000)

    // Check filter section
    const expectedFilters = ['灰度', '棕褐色', '模糊', '锐化', '复古', '反色']

    for (const filter of expectedFilters) {
      await expect(page.locator(`text=${filter}`)).toBeVisible()
    }
  })

  test('should have zoom controls', async ({ page }) => {
    // Simulate image loaded
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component) {
        component.currentImage = { width: 800, height: 600 }
      }
    })

    await page.waitForTimeout(1000)

    // Check zoom controls
    await expect(page.locator('text=缩放:')).toBeVisible()
    await expect(page.locator('button:has-text("+")')).toBeVisible()
    await expect(page.locator('button:has-text("-")')).toBeVisible()
    await expect(page.locator('button:has-text("重置")')).toBeVisible()
  })

  test('should have undo/redo functionality', async ({ page }) => {
    // Simulate image loaded
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component) {
        component.currentImage = { width: 800, height: 600 }
        component.history = [{}] // Simulate some history
      }
    })

    await page.waitForTimeout(1000)

    // Check history controls
    await expect(page.locator('text=历史记录')).toBeVisible()
    await expect(page.locator('button:has-text("撤销")')).toBeVisible()
    await expect(page.locator('button:has-text("重做")')).toBeVisible()
  })

  test('should support multiple output formats', async ({ page }) => {
    // Simulate image loaded
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component) {
        component.currentImage = { width: 800, height: 600 }
      }
    })

    await page.waitForTimeout(1000)

    // Check for save button
    await expect(page.locator('button:has-text("保存图像")')).toBeVisible()
    await expect(page.locator('button:has-text("重置")')).toBeVisible()
    await expect(page.locator('button:has-text("清除")')).toBeVisible()
  })

  test('should handle tool selection', async ({ page }) => {
    // Simulate image loaded
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component) {
        component.currentImage = { width: 800, height: 600 }
      }
    })

    await page.waitForTimeout(1000)

    // Click on brush tool
    const brushTool = page.locator('button:has-text("🖌️ 画笔")')
    await brushTool.click()

    // Should show brush controls
    await expect(page.locator('text=画笔大小')).toBeVisible()
    await expect(page.locator('text=颜色')).toBeVisible()

    // Click on text tool
    const textTool = page.locator('button:has-text("📝 文本")')
    await textTool.click()

    // Should show text controls
    await expect(page.locator('text=文本')).toBeVisible()
    await expect(page.locator('text=字体大小')).toBeVisible()
  })

  test('should adjust image properties with sliders', async ({ page }) => {
    // Simulate image loaded
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component) {
        component.currentImage = { width: 800, height: 600 }
      }
    })

    await page.waitForTimeout(1000)

    // Test brightness slider
    const brightnessSlider = page.locator('.ant-slider').first()
    await expect(brightnessSlider).toBeVisible()

    // Interact with slider (drag to different position)
    await brightnessSlider.click({ position: { x: 50, y: 10 } })

    // Verify other sliders exist
    const sliders = page.locator('.ant-slider')
    await expect(sliders).toHaveCount(4) // brightness, contrast, saturation, hue
  })
})
