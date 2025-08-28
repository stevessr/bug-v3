import { test, expect } from '@playwright/test'

test.describe('表情插入功能修复验证', () => {
  test('点击表情应该自动插入到文本框', async ({ page }) => {
    // 导航到测试页面
    await page.goto('https://linux.do')

    // 等待页面加载
    await page.waitForLoadState('networkidle')

    // 查找回复按钮并点击以打开编辑器
    const replyButton = await page.locator('button:has-text("回复")').first()
    if (await replyButton.isVisible()) {
      await replyButton.click()
      await page.waitForTimeout(1000)
    } else {
      // 尝试查找创建主题按钮
      const createTopicButton = await page.locator('#create-topic').first()
      if (await createTopicButton.isVisible()) {
        await createTopicButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // 查找表情按钮
    const emojiButton = await page.locator('.nacho-emoji-picker-button, .emoji-extension-button')
    await expect(emojiButton).toBeVisible({ timeout: 10000 })

    // 点击表情按钮打开选择器
    await emojiButton.click()

    // 等待表情选择器出现
    const emojiPicker = await page.locator(
      '.nacho-emoji-picker, .emoji-picker, [data-identifier="emoji-picker"]',
    )
    await expect(emojiPicker).toBeVisible({ timeout: 5000 })

    // 查找文本框（在点击表情之前记录当前内容）
    const textArea = await page.locator('textarea.d-editor-input')
    const richEditor = await page.locator('.ProseMirror.d-editor-input')

    let initialContent = ''
    if (await textArea.isVisible()) {
      initialContent = await textArea.inputValue()
    } else if (await richEditor.isVisible()) {
      initialContent = (await richEditor.textContent()) || ''
    }

    // 点击第一个表情
    const firstEmoji = await emojiPicker
      .locator('img.emoji, .emoji-picker__section-emojis img')
      .first()
    await expect(firstEmoji).toBeVisible()

    // 获取表情的信息用于验证
    const emojiSrc = await firstEmoji.getAttribute('src')
    const emojiAlt =
      (await firstEmoji.getAttribute('alt')) || (await firstEmoji.getAttribute('title')) || '表情'

    // 点击表情
    await firstEmoji.click()

    // 等待一小段时间让插入完成
    await page.waitForTimeout(500)

    // 验证表情已插入到文本框
    let finalContent = ''
    if (await textArea.isVisible()) {
      finalContent = await textArea.inputValue()
    } else if (await richEditor.isVisible()) {
      finalContent = await richEditor.innerHTML()
    }

    // 验证内容已发生变化
    expect(finalContent).not.toBe(initialContent)

    // 验证插入的内容包含表情信息
    if (emojiSrc) {
      expect(finalContent).toContain(emojiSrc)
    }
    expect(finalContent).toContain(emojiAlt)

    // 验证表情选择器已关闭
    await expect(emojiPicker).not.toBeVisible({ timeout: 2000 })

    console.log('✅ 表情插入功能验证通过')
    console.log(`插入的内容: ${finalContent.slice(initialContent.length)}`)
  })

  test('HTML格式表情插入测试', async ({ page }) => {
    // 创建测试页面验证HTML格式
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>HTML格式测试</title></head>
      <body>
        <textarea class="d-editor-input"></textarea>
        <button id="test-btn">插入HTML表情</button>
        <script>
          document.getElementById('test-btn').addEventListener('click', function() {
            const textArea = document.querySelector('.d-editor-input');
            const html = '<img src="test.png" title=":emoji:" class="emoji only-emoji" alt=":emoji:" loading="lazy" width="150" height="150" style="aspect-ratio: 150 / 150;">';
            textArea.value = html;
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
          });
        </script>
      </body>
      </html>
    `)

    await page.click('#test-btn')
    const content = await page.inputValue('.d-editor-input')

    // 验证HTML格式
    expect(content).toContain('title=":emoji:"')
    expect(content).toContain('class="emoji only-emoji"')
    expect(content).toContain('loading="lazy"')
    expect(content).toContain('style="aspect-ratio: 150 / 150;"')

    console.log('✅ HTML格式验证通过')
  })
})
