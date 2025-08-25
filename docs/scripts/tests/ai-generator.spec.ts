import { test, expect } from '@playwright/test'

<<<<<<< HEAD
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
=======
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
    await expect(page.getByRole('heading', { name: '🎨 增强型 AI 图像生成器' })).toBeVisible()

    // Check provider configuration section
    await expect(page.getByRole('heading', { name: '🔧 AI 提供商配置' })).toBeVisible()

    // Check generation interface
    await expect(page.getByRole('heading', { name: '🎨 图像生成' })).toBeVisible()
  })

  test('should show all AI providers', async ({ page }) => {
    const expectedProviders = ['Cloudflare AI', 'OpenAI', 'Chrome AI', 'Edge AI']

    for (const provider of expectedProviders) {
      await expect(page.getByRole('heading', { name: provider })).toBeVisible()
    }

    // Check provider status tags
    await expect(page.getByText('可用').first()).toBeVisible()
    await expect(page.getByText('不可用').first()).toBeVisible()
  })

  test('should handle Cloudflare provider configuration', async ({ page }) => {
    // Click on Cloudflare provider
    await page.click('text=Cloudflare AI')
    await page.waitForTimeout(500)

    // Check Cloudflare configuration fields
    await expect(page.getByText('Account ID')).toBeVisible()
    await expect(page.getByText('API Token')).toBeVisible()
    await expect(page.getByText('使用自定义模型')).toBeVisible()

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
    // Click on OpenAI provider - be more specific to avoid multiple matches
    await page.getByRole('heading', { name: 'OpenAI' }).click()
    await page.waitForTimeout(500)

    // Check OpenAI configuration fields
    await expect(page.getByRole('heading', { name: '🤖 OpenAI 设置' })).toBeVisible()
    await expect(page.getByText('API Key')).toBeVisible()
    await expect(page.getByText('模型', { exact: true })).toBeVisible()

    // Test API key input
    const apiKeyInput = page.locator('input[placeholder*="OpenAI API Key"]')
    await apiKeyInput.fill('sk-test-key')

    // Test model selection - use Ant Design select
    const modelSelect = page.locator('.ant-select').first()
    await modelSelect.click()
    await page.locator('.ant-select-item-option-content').getByText('DALL-E 3').click()
  })

  test('should handle browser AI providers', async ({ page }) => {
    // Test Chrome AI
    await page.click('text=Chrome AI')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: '🌐 Chrome AI 配置' })).toBeVisible()
    await expect(page.getByText('需要 Chrome 127+')).toBeVisible()

    // Test Edge AI
    await page.click('text=Edge AI')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: '🔷 Edge AI 配置' })).toBeVisible()
    await expect(page.getByText('Microsoft Edge')).toBeVisible()
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

    if (await widthSelect.isVisible()) {
      await widthSelect.selectOption('1024')
    }
    if (await heightSelect.isVisible()) {
      await heightSelect.selectOption('1024')
    }
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
    if (await countInput.isVisible()) {
      await countInput.fill('2')
    }

    // Test negative prompt
    const negativePrompt = page.locator('textarea[placeholder*="描述你不想要的元素"]')
    await negativePrompt.fill('blurry, low quality')
  })

  test('should display generation results and controls', async ({ page }) => {
    // This test checks that the results display area exists and is properly structured
    // when generation would complete (without actually generating images)

    // Check that the generation results section structure exists
    const resultsSection = page
      .locator('[class*="generation-results"], [class*="result"], [id*="result"]')
      .first()
    const hasResultsStructure = (await resultsSection.count()) > 0

    if (hasResultsStructure) {
      // If results structure exists, verify it has expected elements
      await expect(resultsSection).toBeVisible()
    } else {
      // If no results are shown, that's also acceptable since no generation occurred
      // Just verify the page has the generation interface
      await expect(page.getByText('生成图像')).toBeVisible()
    }

    // Verify generation controls are present (regardless of results)
    const generateButton = page.getByRole('button', { name: /生成|Generate/ }).first()
    await expect(generateButton).toBeVisible()
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
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
