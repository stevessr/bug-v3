import { test, expect } from '@playwright/test'

test.describe('AI Image Generator Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')
    
    // Navigate to AI generator tab
    await page.click('text=AI 图像生成器')
    await page.waitForTimeout(1000)
  })

  test('should display AI generator correctly', async ({ page }) => {
    // Check main heading
    await expect(page.locator('text=增强型 AI 图像生成器')).toBeVisible()
    
    // Check provider configuration section
    await expect(page.locator('text=AI 提供商配置')).toBeVisible()
    
    // Check generation interface
    await expect(page.locator('text=图像生成')).toBeVisible()
  })

  test('should show all AI providers', async ({ page }) => {
    const expectedProviders = ['Cloudflare AI', 'OpenAI', 'Chrome AI', 'Edge AI']
    
    for (const provider of expectedProviders) {
      await expect(page.locator(`text=${provider}`)).toBeVisible()
    }
    
    // Check provider status tags
    await expect(page.locator('text=可用')).toBeVisible()
    await expect(page.locator('text=不可用')).toBeVisible()
  })

  test('should handle Cloudflare provider configuration', async ({ page }) => {
    // Click on Cloudflare provider
    await page.click('text=Cloudflare AI')
    await page.waitForTimeout(500)
    
    // Check Cloudflare configuration fields
    await expect(page.locator('text=Account ID')).toBeVisible()
    await expect(page.locator('text=API Token')).toBeVisible()
    await expect(page.locator('text=使用自定义模型')).toBeVisible()
    
    // Test input fields
    const accountIdInput = page.locator('input[placeholder*="Account ID"]')
    const apiTokenInput = page.locator('input[placeholder*="API Token"]')
    
    await accountIdInput.fill('test-account-id')
    await apiTokenInput.fill('test-api-token')
    
    // Test custom model checkbox
    const customModelCheck = page.locator('input[type="checkbox"]')
    await customModelCheck.check()
    
    await expect(page.locator('input[placeholder*="@cf/stable-diffusion"]')).toBeVisible()
  })

  test('should handle OpenAI provider configuration', async ({ page }) => {
    // Click on OpenAI provider
    await page.click('text=OpenAI')
    await page.waitForTimeout(500)
    
    // Check OpenAI configuration fields
    await expect(page.locator('text=OpenAI 配置')).toBeVisible()
    await expect(page.locator('text=API Key')).toBeVisible()
    await expect(page.locator('text=模型')).toBeVisible()
    
    // Test API key input
    const apiKeyInput = page.locator('input[placeholder*="OpenAI API Key"]')
    await apiKeyInput.fill('sk-test-key')
    
    // Test model selection
    const modelSelect = page.locator('select').first()
    await modelSelect.selectOption('dall-e-3')
  })

  test('should handle browser AI providers', async ({ page }) => {
    // Test Chrome AI
    await page.click('text=Chrome AI')
    await page.waitForTimeout(500)
    
    await expect(page.locator('text=Chrome AI 配置')).toBeVisible()
    await expect(page.locator('text=需要 Chrome 127+')).toBeVisible()
    
    // Test Edge AI
    await page.click('text=Edge AI')
    await page.waitForTimeout(500)
    
    await expect(page.locator('text=Edge AI 配置')).toBeVisible()
    await expect(page.locator('text=Microsoft Edge')).toBeVisible()
  })

  test('should test AI connections', async ({ page }) => {
    // Configure Cloudflare
    await page.click('text=Cloudflare AI')
    await page.waitForTimeout(500)
    
    const accountIdInput = page.locator('input[placeholder*="Account ID"]')
    const apiTokenInput = page.locator('input[placeholder*="API Token"]')
    
    await accountIdInput.fill('test-account-id')
    await apiTokenInput.fill('test-api-token')
    
    // Click test connection
    const testButton = page.locator('button:has-text("测试连接")')
    await testButton.click()
    
    // Should show loading state
    await expect(testButton).toHaveAttribute('class', /loading/)
    
    // Wait for result (simulated)
    await page.waitForTimeout(2000)
  })

  test('should handle image generation interface', async ({ page }) => {
    // Check prompt input
    await expect(page.locator('textarea[placeholder*="描述你想要生成的图像"]')).toBeVisible()
    
    // Check negative prompt
    await expect(page.locator('textarea[placeholder*="描述你不想要的元素"]')).toBeVisible()
    
    // Check generation parameters
    await expect(page.locator('text=宽度')).toBeVisible()
    await expect(page.locator('text=高度')).toBeVisible()
    await expect(page.locator('text=生成数量')).toBeVisible()
    
    // Test parameter inputs
    const widthSelect = page.locator('select').nth(1)
    const heightSelect = page.locator('select').nth(2)
    
    await widthSelect.selectOption('1024')
    await heightSelect.selectOption('1024')
  })

  test('should generate images with proper validation', async ({ page }) => {
    // Try to generate without prompt (should be disabled)
    const generateButton = page.locator('button:has-text("生成图像")')
    await expect(generateButton).toBeDisabled()
    
    // Add prompt
    const promptInput = page.locator('textarea[placeholder*="描述你想要生成的图像"]')
    await promptInput.fill('A beautiful sunset over mountains')
    
    // Button should still be disabled without provider config
    await expect(generateButton).toBeDisabled()
    
    // Configure provider (Cloudflare)
    await page.click('text=Cloudflare AI')
    await page.waitForTimeout(500)
    
    const accountIdInput = page.locator('input[placeholder*="Account ID"]')
    const apiTokenInput = page.locator('input[placeholder*="API Token"]')
    
    await accountIdInput.fill('test-account-id')
    await apiTokenInput.fill('test-api-token')
    
    // Now button should be enabled
    await expect(generateButton).toBeEnabled()
    
    // Click generate
    await generateButton.click()
    
    // Should show generating state
    await expect(page.locator('text=生成中...')).toBeVisible()
    
    // Should show progress
    await expect(page.locator('.animate-spin')).toBeVisible()
    
    // Wait for completion (simulated)
    await page.waitForTimeout(5000)
    
    // Should show results
    await expect(page.locator('text=生成结果')).toBeVisible()
  })

  test('should handle advanced generation parameters', async ({ page }) => {
    // Check guidance scale slider
    await expect(page.locator('text=引导强度')).toBeVisible()
    
    // Test count input
    const countInput = page.locator('input[type="number"]')
    await countInput.fill('2')
    
    // Test negative prompt
    const negativePrompt = page.locator('textarea[placeholder*="描述你不想要的元素"]')
    await negativePrompt.fill('blurry, low quality')
  })

  test('should display generation results and controls', async ({ page }) => {
    // Simulate generation completion
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component && component.generatedImages) {
        component.generatedImages = [
          {
            url: 'https://picsum.photos/512/512?random=1',
            timestamp: new Date().toLocaleString()
          }
        ]
      }
    })
    
    await page.waitForTimeout(1000)
    
    // Check result display
    await expect(page.locator('text=生成结果')).toBeVisible()
    
    // Check action buttons
    await expect(page.locator('button:has-text("下载")')).toBeVisible()
    await expect(page.locator('button:has-text("复制")')).toBeVisible()
  })

  test('should initialize browser AI providers', async ({ page }) => {
    // Test Chrome AI initialization
    await page.click('text=Chrome AI')
    await page.waitForTimeout(500)
    
    const chromeInitButton = page.locator('button:has-text("初始化 Chrome AI")')
    if (await chromeInitButton.isVisible()) {
      await chromeInitButton.click()
      await page.waitForTimeout(2000)
    }
    
    // Test Edge AI initialization
    await page.click('text=Edge AI')
    await page.waitForTimeout(500)
    
    const edgeInitButton = page.locator('button:has-text("初始化 Edge AI")')
    if (await edgeInitButton.isVisible()) {
      await edgeInitButton.click()
      await page.waitForTimeout(2000)
    }
  })
})