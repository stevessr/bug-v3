import { test, expect } from '@playwright/test'

test.describe('AI Emoji Renaming Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
    await page.waitForLoadState('networkidle')

    // Navigate to emoji naming tab
    await page.click('text=AI 表情重命名')
    await page.waitForTimeout(1000)
  })

  test('should display emoji renaming interface correctly', async ({ page }) => {
    // Check main heading
    await expect(page.getByRole('heading', { name: '🤖 AI 表情符号重命名系统' })).toBeVisible()

    // Check provider selection section
    await expect(page.getByRole('heading', { name: '🔧 AI 提供商选择' })).toBeVisible()

    // Check emoji selection section
    await expect(page.getByRole('heading', { name: '📱 表情选择与处理' })).toBeVisible()
  })

  test('should show all AI providers with proper features', async ({ page }) => {
    const expectedProviders = [
      'Google Gemini',
      'OpenAI GPT-4o',
      'Anthropic Claude',
      'OpenAI 兼容 API',
      'Chrome AI',
      'Edge AI'
    ]

    for (const provider of expectedProviders) {
      await expect(page.getByRole('heading', { name: provider, exact: true })).toBeVisible()
    }

    // Check URL support tags
    await expect(page.getByText('直接URL').first()).toBeVisible()
    await expect(page.getByText('需要缓存').first()).toBeVisible()
  })

  test('should configure Google Gemini provider', async ({ page }) => {
    // Click on Gemini provider
    await page.click('text=Google Gemini')
    await page.waitForTimeout(500)

    // Check Gemini configuration
    await expect(page.getByRole('heading', { name: '🔍 Google Gemini 配置' })).toBeVisible()
    await expect(page.getByText('API Key')).toBeVisible()
    await expect(page.getByText('模型')).toBeVisible()

    // Test input fields
    const apiKeyInput = page.locator('input[placeholder*="Gemini API Key"]')
    await apiKeyInput.fill('test-gemini-key')

    // Test model selection
    const modelSelect = page.locator('select').first()
    await modelSelect.selectOption('gemini-1.5-pro')
  })

  test('should configure OpenAI provider', async ({ page }) => {
    // Click on OpenAI provider
    await page.click('text=OpenAI GPT-4o')
    await page.waitForTimeout(500)

    // Check OpenAI configuration
    await expect(page.getByRole('heading', { name: '🤖 OpenAI GPT-4o 配置' })).toBeVisible()

    await expect(page.getByText('API Key')).toBeVisible()

    // Test API key input
    const apiKeyInput = page.locator('input[placeholder*="OpenAI API Key"]')
    await apiKeyInput.fill('sk-test-openai-key')

    // Test model selection
    const modelSelect = page.locator('select').first()
    await modelSelect.selectOption('gpt-4o')
  })

  test('should configure Anthropic Claude provider', async ({ page }) => {
    // Click on Claude provider
    await page.click('text=Anthropic Claude')
    await page.waitForTimeout(500)

    // Check Claude configuration
    await expect(page.getByText('API Key')).toBeVisible()

    // Test API key input
    const apiKeyInput = page.locator('input[placeholder*="Anthropic API Key"]')
    await apiKeyInput.fill('test-claude-key')

    // Test model selection
    const modelSelect = page.locator('select').first()
    await modelSelect.selectOption('claude-3-5-sonnet-20241022')
  })

  test('should configure OpenAI compatible API', async ({ page }) => {
    // Click on OpenAI compatible provider
    await page.click('text=OpenAI 兼容 API')
    await page.waitForTimeout(500)

    // Check configuration fields
    await expect(page.getByText('API Endpoint')).toBeVisible()
    await expect(page.getByText('模型名称')).toBeVisible()

    // Test configuration inputs
    const endpointInput = page.locator('input[placeholder*="https://api.example.com/v1"]')
    const apiKeyInput = page.locator('input[placeholder*="API Key"]')
    const modelInput = page.locator('input[placeholder*="model-name"]')

    await endpointInput.fill('https://api.example.com/v1')
    await apiKeyInput.fill('test-api-key')
    await modelInput.fill('gpt-4-vision')
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
    await expect(page.locator('text=Microsoft Edge AI')).toBeVisible()
  })

  test('should display emoji grid for selection', async ({ page }) => {
    // Check emoji selection section
    await expect(page.locator('text=选择要重命名的表情')).toBeVisible()

    // Check action buttons
    await expect(page.getByRole('button', { name: '全选' })).toBeVisible()
    await expect(page.getByRole('button', { name: '清除选择' })).toBeVisible()

    // Check emoji grid
    const emojiGrid = page.locator('.grid-cols-8')
    await expect(emojiGrid).toBeVisible()

    // Check selection counter
    await expect(page.locator('text=已选择')).toBeVisible()
  })

  test('should handle emoji selection', async ({ page }) => {
    // Test select all
    await page.click('button:has-text("全选")')
    await page.waitForTimeout(500)

    // Should show selected count
    await expect(page.locator('text=已选择 8 个表情')).toBeVisible()

    // Test clear selection
    await page.click('button:has-text("清除选择")')
    await page.waitForTimeout(500)

    // Should show zero selection
    await expect(page.locator('text=已选择 0 个表情')).toBeVisible()

    // Test individual selection
    const firstEmoji = page.locator('.grid-cols-8 > div').first()
    await firstEmoji.click()

    // Should show 1 selected
    await expect(page.locator('text=已选择 1 个表情')).toBeVisible()
  })

  test('should configure renaming parameters', async ({ page }) => {
    // Check prompt template
    const promptTemplate = page.locator('textarea[placeholder*="分析这个表情包图像"]')
    await expect(promptTemplate).toBeVisible()

    await promptTemplate.fill('自定义提示词模板用于分析表情包')

    // Check naming style
    const styleSelect = page.locator('select').first()
    await styleSelect.selectOption('emotional')

    // Check suggestion count
    const countInput = page.locator('input[type="number"]')
    await countInput.fill('5')
  })

  test('should start batch renaming with proper validation', async ({ page }) => {
    // Try without selection (should be disabled)
    const startButton = page.locator('button:has-text("开始批量重命名")')
    await expect(startButton).toBeDisabled()

    // Select some emojis
    await page.click('button:has-text("全选")')
    await page.waitForTimeout(500)

    // Configure provider first
    await page.click('text=Google Gemini')
    await page.waitForTimeout(500)
    const apiKeyInput = page.locator('input[placeholder*="Gemini API Key"]')
    await apiKeyInput.fill('test-key')

    // Now button should be enabled
    await expect(startButton).toBeEnabled()

    // Start processing
    await startButton.click()

    // Should show processing progress
    await expect(page.locator('text=处理进度')).toBeVisible()
    await expect(page.locator('text=总体进度')).toBeVisible()

    // Wait for processing to complete (simulated)
    await page.waitForTimeout(10000)

    // Should show results
    await expect(page.locator('text=重命名建议')).toBeVisible()
  })

  test('should cache selected emojis', async ({ page }) => {
    // Select some emojis
    await page.click('button:has-text("全选")')
    await page.waitForTimeout(500)

    // Click cache button
    const cacheButton = page.locator('button:has-text("缓存选中表情")')
    await expect(cacheButton).toBeEnabled()

    await cacheButton.click()
    await page.waitForTimeout(2000)

    // Should show success message
    await expect(page.locator('text=已缓存')).toBeVisible()
  })

  test('should handle renaming results and approval', async ({ page }) => {
    // Simulate renaming results
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component && component.renamingResults) {
        component.renamingResults = [
          {
            emojiId: '1',
            emoji: { id: '1', name: '开心', url: 'test.jpg' },
            suggestions: ['快乐', '高兴', '笑容'],
            selectedSuggestion: null
          }
        ]
      }
    })

    await page.waitForTimeout(1000)

    // Check results display
    await expect(page.getByText('当前名称:')).toBeVisible()
    await expect(page.getByText('AI 建议:')).toBeVisible()

    // Check suggestion buttons
    await expect(page.locator('button:has-text("快乐")')).toBeVisible()
    await expect(page.locator('button:has-text("高兴")')).toBeVisible()
    await expect(page.locator('button:has-text("笑容")')).toBeVisible()

    // Test suggestion selection
    await page.click('button:has-text("快乐")')

    // Should enable apply button
    await expect(page.locator('button:has-text("应用重命名")')).toBeEnabled()

    // Test individual apply
    await page.click('button:has-text("应用重命名")')

    // Should show success message
    await page.waitForTimeout(1000)
  })

  test('should handle batch operations on results', async ({ page }) => {
    // Simulate multiple results
    await page.evaluate(() => {
      const component = window.app?.$children?.[0]
      if (component && component.renamingResults) {
        component.renamingResults = [
          {
            emojiId: '1',
            emoji: { id: '1', name: '开心', url: 'test1.jpg' },
            suggestions: ['快乐', '高兴', '笑容'],
            selectedSuggestion: 0
          },
          {
            emojiId: '2',
            emoji: { id: '2', name: '哭泣', url: 'test2.jpg' },
            suggestions: ['难过', '伤心', '眼泪'],
            selectedSuggestion: 1
          }
        ]
      }
    })

    await page.waitForTimeout(1000)

    // Check batch operations
    await expect(page.getByRole('button', { name: '应用所有重命名' })).toBeVisible()
    await expect(page.getByRole('button', { name: '清除结果' })).toBeVisible()

    // Test apply all
    await page.click('button:has-text("应用所有重命名")')

    // Should process all selected renames
    await page.waitForTimeout(1000)
  })

  test('should test AI connection', async ({ page }) => {
    // Configure a provider
    await page.click('text=Google Gemini')
    await page.waitForTimeout(500)

    const apiKeyInput = page.locator('input[placeholder*="Gemini API Key"]')
    await apiKeyInput.fill('test-gemini-key')

    // Click test connection
    const testButton = page.locator('button:has-text("测试连接")')
    await testButton.click()

    // Should show loading state
    await expect(testButton).toHaveAttribute('class', /loading/)

    // Wait for test result
    await page.waitForTimeout(2000)
  })
})
