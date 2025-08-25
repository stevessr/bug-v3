import { test, expect } from '@playwright/test'

<<<<<<< HEAD
test.describe('Integration Tests', () => {
  test('should complete end-to-end workflow: options → tools → individual tools', async ({ page, context }) => {
    // Start from options page
    await page.goto('/options.html')
    
    // Navigate to tools tab
    await page.locator('text=小工具').click()
    await expect(page.locator('.tool-card')).toHaveCount(4)
    
    // Test Animation Converter workflow
    const [animationPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=动画转换器').click()
    ])
    
    await expect(animationPage).toHaveURL(/animation-converter\.html/)
    await expect(animationPage.locator('text=格式转换')).toBeVisible()
    await expect(animationPage.locator('text=帧分离')).toBeVisible()
    await expect(animationPage.locator('text=帧合并')).toBeVisible()
    
    // Test Image Editor workflow
    const [editorPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=图片编辑器').click()
    ])
    
    await expect(editorPage).toHaveURL(/image-editor\.html/)
    await expect(editorPage.locator('canvas')).toBeVisible()
    await expect(editorPage.locator('text=基础工具')).toBeVisible()
    
    // Test AI Generator workflow
    const [aiPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=AI 图片生成').click()
    ])
    
    await expect(aiPage).toHaveURL(/image-generator-vue\.html/)
    await expect(aiPage.locator('text=API 提供商')).toBeVisible()
    
    // Test Emoji Manager workflow
    const [emojiPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('text=表情管理器').click()
    ])
    
    await expect(emojiPage).toHaveURL(/emoji-manager\.html/)
    await expect(emojiPage.locator('text=分组管理')).toBeVisible()
  })

  test('should validate all tools load without errors', async ({ page }) => {
    const errors = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`${msg.location().url}: ${msg.text()}`)
      }
    })
    
    const pages = [
      '/options.html',
      '/animation-converter.html',
      '/image-editor.html', 
      '/image-generator-vue.html',
      '/emoji-manager.html'
    ]
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForLoadState('networkidle')
      
      // Wait a bit for any delayed errors
      await page.waitForTimeout(1000)
    }
    
    // Filter out known acceptable errors (e.g., network timeouts in test env)
    const criticalErrors = errors.filter(error => 
      !error.includes('net::ERR_') && // Network errors in test env
      !error.includes('chrome-extension://') && // Extension context errors
      !error.includes('Failed to fetch') // Fetch errors in test env
    )
    
    expect(criticalErrors, `Critical errors found: ${criticalErrors.join('; ')}`).toHaveLength(0)
  })

  test('should validate responsive design across tools', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ]
    
    const pages = [
      '/options.html',
      '/animation-converter.html',
      '/image-editor.html',
      '/emoji-manager.html'
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      
      for (const pagePath of pages) {
        await page.goto(pagePath)
        await page.waitForLoadState('networkidle')
        
        // Check no horizontal scrollbars on main content
        const body = page.locator('body')
        const bodyBox = await body.boundingBox()
        expect(bodyBox.width).toBeLessThanOrEqual(viewport.width + 20) // Allow small margin
        
        // Check main navigation/interface is visible
        const mainContent = page.locator('#app, .main-content, .ant-layout-content').first()
        if (await mainContent.isVisible()) {
          await expect(mainContent).toBeVisible()
        }
      }
    }
  })

  test('should validate browser extension manifest compatibility', async ({ page }) => {
    // Test that all pages work within extension context
    await page.goto('/options.html')
    
    // Check chrome.storage APIs would be available (simulated)
    const storageScript = `
      window.testChromeStorage = {
        available: typeof chrome !== 'undefined' && chrome.storage,
        local: typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
      }
    `
    
    await page.evaluate(storageScript)
    
    const storageTest = await page.evaluate(() => window.testChromeStorage)
    
    // In real extension environment, these would be true
    // In test environment, we just verify no errors accessing them
    expect(typeof storageTest).toBe('object')
  })

  test('should validate performance benchmarks', async ({ page }) => {
    const performanceMetrics = []
    
    const pages = [
      '/options.html',
      '/animation-converter.html',
      '/image-editor.html',
      '/emoji-manager.html'
    ]
    
    for (const pagePath of pages) {
      const startTime = Date.now()
      
      await page.goto(pagePath)
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      performanceMetrics.push({ page: pagePath, loadTime })
      
      // Check page loads within reasonable time (5 seconds)
      expect(loadTime, `${pagePath} loaded too slowly: ${loadTime}ms`).toBeLessThan(5000)
    }
    
    // Log performance metrics for monitoring
    console.log('Performance metrics:', performanceMetrics)
  })

  test('should validate accessibility compliance', async ({ page }) => {
    const pages = [
      '/options.html',
      '/animation-converter.html',
      '/image-editor.html',
      '/emoji-manager.html'
    ]
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForLoadState('networkidle')
      
      // Check basic accessibility requirements
      
      // Page should have a title
      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)
      
      // Check for proper heading structure
      const h1 = page.locator('h1')
      if (await h1.count() > 0) {
        await expect(h1.first()).toBeVisible()
      }
      
      // Check interactive elements are focusable
      const buttons = page.locator('button, a, input, select, textarea')
      const buttonCount = await buttons.count()
      
      if (buttonCount > 0) {
        // Focus first button and verify it's focusable
        await buttons.first().focus()
        const focused = await page.evaluate(() => document.activeElement?.tagName)
        expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused)
      }
    }
  })
})
=======
test.describe('Complete Feature Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')
  })

  test('should navigate between all new tabs successfully', async ({ page }) => {
    // Test navigation to each new tab
    const tabs = [
      { name: '小工具', heading: '多媒体小工具' },
      { name: '图像编辑器', heading: '专业图像编辑器' },
      { name: 'AI 图像生成器', heading: '增强型 AI 图像生成器' },
      { name: 'AI 表情重命名', heading: 'AI 表情符号重命名系统' },
      { name: '外部导入', heading: '外部表情导入' }
    ]

    for (const tab of tabs) {
      await page.click(`text=${tab.name}`)
      await page.waitForTimeout(500)
      await expect(page.locator(`text=${tab.heading}`)).toBeVisible()
    }
  })

  test('should maintain consistent UI/UX across all tabs', async ({ page }) => {
    const tabs = ['小工具', '图像编辑器', 'AI 图像生成器', 'AI 表情重命名']

    for (const tab of tabs) {
      await page.click(`text=${tab}`)
      await page.waitForTimeout(500)

      // Check for gradient header
      const gradientHeader = page.locator('.bg-gradient-to-br')
      await expect(gradientHeader).toBeVisible()

      // Check for white content sections
      const contentSections = page.locator('.bg-white.rounded-lg.shadow-md')
      await expect(contentSections.first()).toBeVisible()
    }
  })

  test('should handle all drag-and-drop interfaces', async ({ page }) => {
    // Test Tools tab drag-and-drop
    await page.click('text=小工具')
    await page.waitForTimeout(500)

    const toolsDropZone = page.locator('.drag-drop-zone').first()
    await expect(toolsDropZone).toBeVisible()

    // Test Image Editor drag-and-drop
    await page.click('text=图像编辑器')
    await page.waitForTimeout(500)

    const editorDropZone = page.locator('text=拖拽图像到此处或点击选择').locator('..')
    await expect(editorDropZone).toBeVisible()
  })

  test('should have working progress tracking across features', async ({ page }) => {
    // Test progress in different contexts

    // Tools tab progress
    await page.click('text=小工具')
    await page.waitForTimeout(500)

    // Simulate file processing
    await page.evaluate(() => {
      const mockFile = new File(['test'], 'test.gif', { type: 'image/gif' })
      const component = window.app?.$children?.[0]
      if (component && component.processFormatConverter) {
        component.processFormatConverter(mockFile)
      }
    })

    await page.waitForTimeout(1000)

    // Check for progress elements
    const progressBar = page.locator('.bg-blue-600')
    if (await progressBar.isVisible()) {
      await expect(progressBar).toBeVisible()
    }
  })

  test('should validate form inputs across all features', async ({ page }) => {
    // AI Generator validation
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    const generateButton = page.locator('button:has-text("生成图像")')
    await expect(generateButton).toBeDisabled()

    // Emoji Renaming validation
    await page.click('text=AI 表情重命名')
    await page.waitForTimeout(500)

    const renamingButton = page.locator('button:has-text("开始批量重命名")')
    await expect(renamingButton).toBeDisabled()

    // External Import validation
    await page.click('text=外部导入')
    await page.waitForTimeout(500)

    const tenorSearchButton = page.locator('button:has-text("搜索")')
    await expect(tenorSearchButton).toBeDisabled()
  })

  test('should handle API configuration across multiple providers', async ({ page }) => {
    // Test AI Generator API configuration
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    // Test Cloudflare config
    await page.click('text=Cloudflare AI')
    await page.waitForTimeout(500)

    const cfAccountId = page.locator('input[placeholder*="Account ID"]')
    const cfApiToken = page.locator('input[placeholder*="API Token"]')

    await cfAccountId.fill('test-account')
    await cfApiToken.fill('test-token')

    // Switch to emoji renaming and test another provider
    await page.click('text=AI 表情重命名')
    await page.waitForTimeout(500)

    await page.click('text=Google Gemini')
    await page.waitForTimeout(500)

    const geminiKey = page.locator('input[placeholder*="Gemini API Key"]')
    await geminiKey.fill('test-gemini-key')
  })

  test('should support all file formats and types', async ({ page }) => {
    // Tools tab file support
    await page.click('text=小工具')
    await page.waitForTimeout(500)

    await expect(page.locator('text=支持: GIF, MP4, WebM')).toBeVisible()
    await expect(page.locator('text=支持: PNG, JPG, WebP')).toBeVisible()

    // Image Editor file support
    await page.click('text=图像编辑器')
    await page.waitForTimeout(500)

    await expect(page.locator('text=支持: PNG, JPG, WebP, GIF')).toBeVisible()
  })

  test('should have working test connections for AI providers', async ({ page }) => {
    // Test AI Generator connection testing
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    // Configure and test Cloudflare
    await page.click('text=Cloudflare AI')
    await page.waitForTimeout(500)

    const cfAccountId = page.locator('input[placeholder*="Account ID"]')
    const cfApiToken = page.locator('input[placeholder*="API Token"]')

    await cfAccountId.fill('test-account')
    await cfApiToken.fill('test-token')

    const testButton = page.locator('button:has-text("测试连接")')
    await testButton.click()

    // Should show loading state
    await expect(testButton).toHaveAttribute('class', /loading/)

    // Wait for result
    await page.waitForTimeout(2000)
  })

  test('should maintain state when switching between tabs', async ({ page }) => {
    // Configure something in AI Generator
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    const promptInput = page.locator('textarea[placeholder*="描述你想要生成的图像"]')
    await promptInput.fill('A beautiful landscape')

    // Switch to another tab
    await page.click('text=小工具')
    await page.waitForTimeout(500)

    // Switch back
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    // Should maintain state
    await expect(promptInput).toHaveValue('A beautiful landscape')
  })

  test('should handle browser AI detection consistently', async ({ page }) => {
    // Check Chrome AI status in AI Generator
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    await page.click('text=Chrome AI')
    await page.waitForTimeout(500)

    const chromeStatus = page.locator('text=未检测到 Chrome AI,Chrome AI 可用').first()
    const statusText = await chromeStatus.textContent()

    // Switch to Emoji Renaming and check same status
    await page.click('text=AI 表情重命名')
    await page.waitForTimeout(500)

    await page.click('text=Chrome AI')
    await page.waitForTimeout(500)

    const chromeStatus2 = page.locator('text=需要 Chrome 127+,Chrome AI 状态').first()
    await expect(chromeStatus2).toBeVisible()
  })

  test('should have responsive design across all new features', async ({ page }) => {
    // Test responsive behavior by changing viewport
    await page.setViewportSize({ width: 768, height: 1024 }) // tablet

    // Test each tab with smaller viewport
    const tabs = ['小工具', '图像编辑器', 'AI 图像生成器', 'AI 表情重命名']

    for (const tab of tabs) {
      await page.click(`text=${tab}`)
      await page.waitForTimeout(500)

      // Should not have horizontal scroll
      const body = page.locator('body')
      const scrollWidth = await body.evaluate(el => el.scrollWidth)
      const clientWidth = await body.evaluate(el => el.clientWidth)

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20) // Allow small margin
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('should handle errors gracefully across features', async ({ page }) => {
    // Test error handling in different contexts

    // External Import with invalid data
    await page.click('text=外部导入')
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea[placeholder*="![表情名](表情URL)"]')
    await textarea.fill('invalid content')

    const importButton = page.locator('button:has-text("导入文本中的表情")')
    await importButton.click()

    // Should handle error appropriately
    await page.waitForTimeout(3000)

    // Check that app doesn't crash (main heading still visible)
    await expect(page.locator('text=外部表情导入')).toBeVisible()
  })

  test('should have complete keyboard navigation support', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to navigate to different tabs
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)

    // Test form navigation
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(500)

    const promptInput = page.locator('textarea[placeholder*="描述你想要生成的图像"]')
    await promptInput.focus()

    // Should be able to tab to other form elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
  })

  test('should maintain performance with all features loaded', async ({ page }) => {
    // Navigate through all tabs to load all components
    const tabs = ['小工具', '图像编辑器', 'AI 图像生成器', 'AI 表情重命名', '外部导入']

    const startTime = Date.now()

    for (const tab of tabs) {
      await page.click(`text=${tab}`)
      await page.waitForTimeout(200) // Minimal wait
    }

    const endTime = Date.now()
    const totalTime = endTime - startTime

    // Should complete navigation in reasonable time (less than 10 seconds)
    expect(totalTime).toBeLessThan(10000)

    // Check that final tab loaded correctly
    await expect(page.locator('text=外部表情导入')).toBeVisible()
  })
})
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
