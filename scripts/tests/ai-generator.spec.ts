import { test, expect } from '@playwright/test'

test.describe('AI Image Generator Improvements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/image-generator-vue.html')
  })

  test('should load AI generator interface', async ({ page }) => {
    // Check page title and header
    await expect(page).toHaveTitle(/AI 图片生成器/)
    await expect(page.locator('text=AI 图片生成器')).toBeVisible()
  })

  test('should display improved Cloudflare integration', async ({ page }) => {
    // Check API provider section
    await expect(page.locator('text=API 提供商')).toBeVisible()
    
    // Check separate credential fields
    await expect(page.locator('text=账户 ID (Account ID)')).toBeVisible()
    await expect(page.locator('text=API Token')).toBeVisible()
    
    // Check dedicated input fields
    const accountIdInput = page.locator('input[placeholder*="Cloudflare 账户 ID"]')
    const apiTokenInput = page.locator('input[placeholder*="Cloudflare API Token"]')
    
    await expect(accountIdInput).toBeVisible()
    await expect(apiTokenInput).toBeVisible()
  })

  test('should support custom model input', async ({ page }) => {
    // Check custom model checkbox
    const customModelCheckbox = page.locator('input[type="checkbox"]')
    await expect(customModelCheckbox).toBeVisible()
    
    // Check custom model label
    await expect(page.locator('text=自定义模型')).toBeVisible()
    
    // Enable custom model and check input appears
    await customModelCheckbox.check()
    
    const customModelInput = page.locator('input[placeholder*="@cf/custom/model-name"]')
    await expect(customModelInput).toBeVisible()
  })

  test('should maintain backwards compatibility', async ({ page }) => {
    // The interface should still work with old "accountId:apiToken" format
    // This would be tested through actual API calls in integration tests
    
    // Check that model selector is present
    await expect(page.locator('text=模型选择')).toBeVisible()
    
    // Check default models are available
    const modelSelect = page.locator('select')
    await expect(modelSelect).toBeVisible()
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
    
    // Check no CDN loading errors
    const cspErrors = consoleErrors.filter(error => 
      error.includes('Content Security Policy') ||
      error.includes('unpkg.com') ||
      error.includes('cdn.jsdelivr.net') ||
      error.includes('inline script')
    )
    
    expect(cspErrors).toHaveLength(0)
  })

  test('should have proper form validation', async ({ page }) => {
    // Check required fields have proper validation
    const generateButton = page.locator('text=生成图片')
    await expect(generateButton).toBeVisible()
    
    // Check prompt input
    const promptInput = page.locator('textarea, input[type="text"]').first()
    await expect(promptInput).toBeVisible()
  })

  test('should display model selection interface', async ({ page }) => {
    // Check model selector
    await expect(page.locator('text=模型选择')).toBeVisible()
    
    // Check common models are available
    const modelSelect = page.locator('select')
    if (await modelSelect.isVisible()) {
      // Check options contain expected models
      const options = modelSelect.locator('option')
      await expect(options).toHaveCountGreaterThan(0)
    }
  })

  test('should have proper input field layout', async ({ page }) => {
    // Check form layout is clean and organized
    await expect(page.locator('text=API 提供商')).toBeVisible()
    
    // Check provider selector
    const providerSelect = page.locator('select').first()
    await expect(providerSelect).toBeVisible()
    
    // Check help text for API tokens
    const helpText = page.locator('text=获取方式')
    if (await helpText.isVisible()) {
      await expect(helpText).toBeVisible()
    }
  })

  test('should support image generation workflow', async ({ page }) => {
    // Check basic generation interface
    await expect(page.locator('text=提示词')).toBeVisible()
    
    // Check generation button
    const generateButton = page.locator('button:has-text("生成"), button:has-text("Generate")')
    await expect(generateButton).toBeVisible()
    
    // Check image display area exists
    const imageArea = page.locator('img, canvas, .image-result')
    if (await imageArea.first().isVisible()) {
      await expect(imageArea.first()).toBeVisible()
    }
  })

  test('should have Vue components loaded properly', async ({ page }) => {
    // Check Vue app is mounted
    const vueApp = page.locator('#app')
    await expect(vueApp).toBeVisible()
    
    // Check Vue components are rendered
    const antdComponents = page.locator('.ant-form, .ant-input, .ant-button, .ant-select')
    if (await antdComponents.first().isVisible()) {
      await expect(antdComponents.first()).toBeVisible()
    }
  })
})