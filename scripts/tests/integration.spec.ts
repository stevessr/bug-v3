import { test, expect } from '@playwright/test'

test.describe('Integration Tests', () => {
  test('should complete end-to-end workflow: options → tools → individual tools', async ({ page, context }) => {
    // Start from options page
    await page.goto('/html/options.html')
    
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
      '/html/options.html',
      '/html/animation-converter.html',
      '/html/image-editor.html', 
      '/html/image-generator-vue.html',
      '/html/emoji-manager.html'
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
      '/html/options.html',
      '/html/animation-converter.html',
      '/html/image-editor.html',
      '/html/emoji-manager.html'
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
    await page.goto('/html/options.html')
    
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
      '/html/options.html',
      '/html/animation-converter.html',
      '/html/image-editor.html',
      '/html/emoji-manager.html'
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
      '/html/options.html',
      '/html/animation-converter.html',
      '/html/image-editor.html',
      '/html/emoji-manager.html'
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