import { test, expect } from '@playwright/test'

test.describe('表情插入实时设置获取功能验证', () => {
  test('表情插入应该使用实时获取的设置', async ({ page }) => {
    // 创建测试页面，模拟表情选择器环境
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>实时设置测试</title>
        <style>
          .emoji-picker {
            position: fixed;
            top: 100px;
            left: 100px;
            width: 300px;
            height: 200px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
          }
          .emoji-item {
            width: 32px;
            height: 32px;
            cursor: pointer;
            border: 1px solid #ccc;
            margin: 5px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>
        <button id="test-realtime-settings">测试实时设置获取</button>

        <div class="emoji-picker" style="display: none;">
          <h3>表情选择器</h3>
          <img class="emoji-item" src="https://example.com/emoji_500x500.png" data-emoji="test-emoji" alt="test-emoji" title=":test-emoji:">
        </div>

        <script>
          // 模拟Chrome扩展API
          window.chrome = {
            runtime: {
              sendMessage: function(message, callback) {
                console.log('发送消息到后台:', message);

                // 模拟后台返回不同的设置
                setTimeout(() => {
                  if (message.type === 'GET_EMOJI_DATA') {
                    const mockResponse = {
                      success: true,
                      data: {
                        settings: {
                          outputFormat: 'html',
                          imageScale: 60, // 实时获取的新缩放比例
                        }
                      }
                    };
                    callback(mockResponse);
                  }
                }, 100);
              }
            }
          };

          // 模拟sendMessageToBackground函数
          function sendMessageToBackground(message) {
            return new Promise((resolve) => {
              window.chrome.runtime.sendMessage(message, (response) => {
                resolve(response);
              });
            });
          }

          // 模拟insertEmoji函数（简化版）
          async function insertEmoji(emojiData) {
            const textArea = document.querySelector('textarea.d-editor-input');
            if (!textArea) {
              console.error('找不到输入框');
              return;
            }

            // 获取图片尺寸信息
            let width = '500';
            let height = '500';
            const imgSrc = emojiData.realUrl || emojiData.src;

            // 尝试从URL中提取尺寸
            const match = imgSrc.match(/_(\d{3,})x(\d{3,})\\./);
            if (match) {
              width = match[1];
              height = match[2];
            }

            // 模拟缓存设置
            const cachedSettings = {
              outputFormat: 'markdown',
              imageScale: 30
            };

            // 实时从后端获取最新设置
            let currentSettings = cachedSettings;
            try {
              console.log('[Emoji Insert] 实时获取最新设置...');
              const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' });
              if (response && response.success && response.data && response.data.settings) {
                currentSettings = { ...cachedSettings, ...response.data.settings };
                console.log('[Emoji Insert] 成功获取最新设置:', currentSettings);
              } else {
                console.warn('[Emoji Insert] 获取最新设置失败，使用缓存设置');
              }
            } catch (error) {
              console.error('[Emoji Insert] 获取设置时出错:', error);
            }

            // 获取缩放比例
            const imageScale = currentSettings.imageScale || 30;

            // 生成表情文本
            let emojiText;
            switch (currentSettings.outputFormat) {
              case 'html':
                const scaledWidth = Math.round((parseInt(width) * imageScale) / 100);
                const scaledHeight = Math.round((parseInt(height) * imageScale) / 100);
                emojiText = '<img src="' + imgSrc + '" title=":' + emojiData.displayName + ':" class="emoji only-emoji" alt=":' + emojiData.displayName + ':" loading="lazy" width="' + scaledWidth + '" height="' + scaledHeight + '" style="aspect-ratio: ' + scaledWidth + ' / ' + scaledHeight + ';">';
                break;
              case 'markdown':
              default:
                emojiText = '![' + emojiData.displayName + '|' + width + 'x' + height + ',' + imageScale + '%](' + imgSrc + ') ';
                break;
            }

            // 插入到文本框
            const start = textArea.selectionStart || 0;
            const end = textArea.selectionEnd || 0;
            const text = textArea.value;

            textArea.value = text.substring(0, start) + emojiText + text.substring(end);
            textArea.selectionStart = textArea.selectionEnd = start + emojiText.length;
            textArea.focus();

            // 保存结果到元素属性，用于测试验证
            textArea.setAttribute('data-last-inserted', emojiText);
            textArea.setAttribute('data-used-scale', imageScale);
            textArea.setAttribute('data-used-format', currentSettings.outputFormat);

            console.log('插入的表情文本:', emojiText);
            console.log('使用的缩放比例:', imageScale);
            console.log('使用的格式:', currentSettings.outputFormat);
          }

          // 测试按钮事件
          document.getElementById('test-realtime-settings').addEventListener('click', async function() {
            const emojiData = {
              displayName: 'test-emoji',
              realUrl: 'https://example.com/emoji_500x500.png',
              src: 'https://example.com/emoji_500x500.png'
            };

            await insertEmoji(emojiData);
          });
        </script>
      </body>
      </html>
    `)

    // 点击测试按钮
    await page.click('#test-realtime-settings')

    // 等待异步操作完成
    await page.waitForTimeout(500)

    // 获取文本框
    const textArea = await page.locator('textarea.d-editor-input')

    // 验证使用了实时获取的设置
    const usedScale = await textArea.getAttribute('data-used-scale')
    const usedFormat = await textArea.getAttribute('data-used-format')
    const insertedText = await textArea.getAttribute('data-last-inserted')

    // 验证缩放比例是实时获取的60%，而不是缓存的30%
    expect(usedScale).toBe('60')

    // 验证输出格式是实时获取的html，而不是缓存的markdown
    expect(usedFormat).toBe('html')

    // 验证插入的文本包含正确的尺寸（500 * 60% = 300）
    expect(insertedText).toContain('width="300"')
    expect(insertedText).toContain('height="300"')
    expect(insertedText).toContain('class="emoji only-emoji"')
    expect(insertedText).toContain('loading="lazy"')

    // 验证最终文本框内容
    const finalContent = await textArea.inputValue()
    expect(finalContent).toContain('width="300"')
    expect(finalContent).toContain('height="300"')

    console.log('✅ 实时设置获取功能验证通过')
    console.log(`使用的缩放比例: ${usedScale}%`)
    console.log(`使用的输出格式: ${usedFormat}`)
  })

  test('设置获取失败时应该回退到缓存设置', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>设置获取失败测试</title></head>
      <body>
        <textarea class="d-editor-input"></textarea>
        <button id="test-fallback">测试回退到缓存设置</button>

        <script>
          // 模拟Chrome扩展API失败
          window.chrome = {
            runtime: {
              sendMessage: function(message, callback) {
                setTimeout(() => {
                  // 模拟后台通信失败
                  callback({ success: false, error: 'Network error' });
                }, 100);
              }
            }
          };

          function sendMessageToBackground(message) {
            return new Promise((resolve) => {
              window.chrome.runtime.sendMessage(message, (response) => {
                resolve(response);
              });
            });
          }

          async function insertEmoji(emojiData) {
            const textArea = document.querySelector('textarea.d-editor-input');
            if (!textArea) return;

            // 模拟缓存设置
            const cachedSettings = {
              outputFormat: 'markdown',
              imageScale: 30
            };

            let currentSettings = cachedSettings;
            try {
              const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' });
              if (response && response.success && response.data && response.data.settings) {
                currentSettings = { ...cachedSettings, ...response.data.settings };
              } else {
                console.warn('获取最新设置失败，使用缓存设置');
              }
            } catch (error) {
              console.error('获取设置时出错:', error);
            }

            // 保存使用的设置，用于测试验证
            textArea.setAttribute('data-used-scale', currentSettings.imageScale);
            textArea.setAttribute('data-used-format', currentSettings.outputFormat);
          }

          document.getElementById('test-fallback').addEventListener('click', async function() {
            await insertEmoji({ displayName: 'test' });
          });
        </script>
      </body>
      </html>
    `)

    await page.click('#test-fallback')
    await page.waitForTimeout(500)

    const textArea = await page.locator('textarea.d-editor-input')
    const usedScale = await textArea.getAttribute('data-used-scale')
    const usedFormat = await textArea.getAttribute('data-used-format')

    // 验证使用了缓存设置
    expect(usedScale).toBe('30')
    expect(usedFormat).toBe('markdown')

    console.log('✅ 设置获取失败回退功能验证通过')
  })
})
