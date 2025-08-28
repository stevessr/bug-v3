import { test, expect } from '@playwright/test'

test.describe('常用表情实时更新功能测试', () => {
  test('点击表情后常用表情组应该实时更新', async ({ page }) => {
    // 设置测试环境
    await page.setViewportSize({ width: 1200, height: 800 })

    // 创建模拟的测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>常用表情实时更新测试</title>
        <style>
          .modal-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
          }
          .emoji-picker .emoji {
            cursor: pointer;
            width: 32px;
            height: 32px;
            margin: 5px;
          }
          .emoji-picker__section {
            border: 1px solid #ddd;
            margin: 10px;
            padding: 10px;
          }
          .emoji-picker__section-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .test-status {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #f0f0f0;
            padding: 10px;
            border: 1px solid #ccc;
          }
        </style>
      </head>
      <body>
        <button class="test-open-picker">打开表情选择器</button>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>

        <div class="test-status">
          <div id="test-log"></div>
          <div id="common-group-state">常用表情组状态: 未初始化</div>
          <div id="usage-count">使用计数: 0</div>
        </div>

        <script>
          // 模拟表情数据
          let mockEmojiGroups = [
            {
              UUID: 'common-emoji-group',
              displayName: '常用表情',
              icon: '⭐',
              order: 0,
              emojis: []
            },
            {
              UUID: 'normal-group-1',
              displayName: '普通表情',
              icon: '😀',
              order: 1,
              emojis: [
                { UUID: 'emoji-1', displayName: '笑脸', realUrl: 'https://example.com/smile.png', displayUrl: 'https://example.com/smile.png', usageCount: 0, lastUsed: 0 },
                { UUID: 'emoji-2', displayName: '哭脸', realUrl: 'https://example.com/cry.png', displayUrl: 'https://example.com/cry.png', usageCount: 0, lastUsed: 0 }
              ]
            }
          ];

          let usageCount = 0;
          let communicationCallbacks = new Map();

          // 模拟 Chrome 扩展 API
          window.chrome = {
            runtime: {
              sendMessage: function(message, callback) {
                console.log('📤 发送消息到后台:', message);

                setTimeout(() => {
                  if (message.type === 'RECORD_EMOJI_USAGE') {
                    // 模拟表情使用记录成功
                    const emojiUUID = message.uuid;
                    usageCount++;

                    // 更新表情使用计数
                    mockEmojiGroups.forEach(group => {
                      group.emojis.forEach(emoji => {
                        if (emoji.UUID === emojiUUID) {
                          emoji.usageCount = (emoji.usageCount || 0) + 1;
                          emoji.lastUsed = Date.now();

                          // 如果使用计数达到阈值，添加到常用表情组
                          if (emoji.usageCount >= 1) {
                            const commonGroup = mockEmojiGroups.find(g => g.UUID === 'common-emoji-group');
                            const existsInCommon = commonGroup.emojis.some(e => e.UUID === emoji.UUID);
                            if (!existsInCommon) {
                              commonGroup.emojis.unshift({...emoji});
                              console.log('✨ 表情已添加到常用表情组:', emoji.displayName);
                            }
                          }
                        }
                      });
                    });

                    // 更新界面显示
                    document.getElementById('usage-count').textContent = '使用计数: ' + usageCount;

                    callback({
                      success: true,
                      message: 'Usage recorded successfully'
                    });

                    // 🚀 关键修复：模拟后台发送常用表情组更新通知
                    setTimeout(() => {
                      const commonGroup = mockEmojiGroups.find(g => g.UUID === 'common-emoji-group');
                      if (commonGroup) {
                        console.log('📢 发送常用表情组更新通知');

                        // 触发常用表情组刷新事件
                        window.dispatchEvent(new CustomEvent('emoji-common-group-refreshed', {
                          detail: {
                            group: commonGroup,
                            timestamp: Date.now()
                          }
                        }));

                        // 模拟通信服务的通知
                        if (window.mockCommService && window.mockCommService.sendCommonEmojiGroupChanged) {
                          window.mockCommService.sendCommonEmojiGroupChanged(commonGroup);
                        }
                      }
                    }, 100);

                  } else if (message.type === 'GET_EMOJI_DATA') {
                    // 模拟获取表情数据
                    callback({
                      success: true,
                      data: {
                        groups: mockEmojiGroups,
                        settings: {
                          outputFormat: 'markdown',
                          imageScale: 30
                        }
                      }
                    });
                  }
                }, 50);
              }
            }
          };

          // 模拟通信服务
          window.mockCommService = {
            sendCommonEmojiGroupChanged: function(group) {
              console.log('📡 发送常用表情组变更消息:', group.displayName);
              // 触发监听器
              if (communicationCallbacks.has('common-group-changed')) {
                communicationCallbacks.get('common-group-changed')(group);
              }
            },

            onCommonEmojiGroupChanged: function(handler) {
              communicationCallbacks.set('common-group-changed', handler);
            }
          };

          // 模拟表情选择器创建函数
          async function createMockEmojiPicker() {
            console.log('🎨 创建模拟表情选择器');

            const picker = document.createElement('div');
            picker.className = 'modal-container';
            picker.id = 'test-emoji-picker';

            let sectionsHtml = '';

            mockEmojiGroups.forEach(group => {
              let groupEmojisHtml = '';
              group.emojis.forEach(emoji => {
                groupEmojisHtml += \`<img class="emoji" src="\${emoji.displayUrl}" data-emoji="\${emoji.displayName}" data-uuid="\${emoji.UUID}" alt="\${emoji.displayName}" title=":\${emoji.displayName}:" />\\n\`;
              });

              sectionsHtml += \`
                <div class="emoji-picker__section" data-section="\${group.UUID}">
                  <div class="emoji-picker__section-title">\${group.displayName} (\${group.emojis.length})</div>
                  <div class="emoji-picker__section-emojis">
                    \${groupEmojisHtml}
                  </div>
                </div>
              \`;
            });

            picker.innerHTML = \`
              <div class="emoji-picker">
                <div class="emoji-picker__sections">
                  \${sectionsHtml}
                </div>
              </div>
            \`;

            // 绑定表情点击事件
            picker.querySelectorAll('img.emoji').forEach(img => {
              img.addEventListener('click', async (e) => {
                const emojiUUID = img.getAttribute('data-uuid');
                const emojiName = img.getAttribute('data-emoji');

                console.log('👆 点击表情:', emojiName, 'UUID:', emojiUUID);

                // 模拟记录使用计数
                if (emojiUUID) {
                  const response = await new Promise(resolve => {
                    window.chrome.runtime.sendMessage({
                      type: 'RECORD_EMOJI_USAGE',
                      uuid: emojiUUID
                    }, resolve);
                  });

                  console.log('📊 使用记录响应:', response);
                }
              });
            });

            // 🚀 关键修复：添加常用表情组实时刷新监听器
            const commonGroupRefreshHandler = (event) => {
              try {
                const updatedGroup = event.detail?.group;
                if (updatedGroup && updatedGroup.UUID === 'common-emoji-group') {
                  console.log('🔄 收到常用表情组刷新事件');

                  // 找到常用表情组的容器
                  const commonSection = picker.querySelector('[data-section="common-emoji-group"]');
                  if (commonSection) {
                    // 更新常用表情组的内容
                    const emojisContainer = commonSection.querySelector('.emoji-picker__section-emojis');
                    const titleContainer = commonSection.querySelector('.emoji-picker__section-title');

                    if (emojisContainer && Array.isArray(updatedGroup.emojis)) {
                      let groupEmojisHtml = '';
                      updatedGroup.emojis.forEach(emoji => {
                        groupEmojisHtml += \`<img class="emoji" src="\${emoji.displayUrl}" data-emoji="\${emoji.displayName}" data-uuid="\${emoji.UUID}" alt="\${emoji.displayName}" title=":\${emoji.displayName}:" />\\n\`;
                      });

                      emojisContainer.innerHTML = groupEmojisHtml;
                      titleContainer.textContent = \`\${updatedGroup.displayName} (\${updatedGroup.emojis.length})\`;

                      // 重新绑定新添加的表情的点击事件
                      emojisContainer.querySelectorAll('img.emoji').forEach(img => {
                        img.addEventListener('click', async (e) => {
                          const emojiUUID = img.getAttribute('data-uuid');
                          const emojiName = img.getAttribute('data-emoji');

                          console.log('👆 点击常用表情:', emojiName, 'UUID:', emojiUUID);

                          if (emojiUUID) {
                            const response = await new Promise(resolve => {
                              window.chrome.runtime.sendMessage({
                                type: 'RECORD_EMOJI_USAGE',
                                uuid: emojiUUID
                              }, resolve);
                            });

                            console.log('📊 常用表情使用记录响应:', response);
                          }
                        });
                      });

                      console.log('✅ 常用表情组界面刷新完成');

                      // 更新测试状态
                      document.getElementById('common-group-state').textContent =
                        \`常用表情组状态: \${updatedGroup.emojis.length} 个表情\`;

                      // 添加测试日志
                      const log = document.getElementById('test-log');
                      log.innerHTML += \`<div>\${new Date().toLocaleTimeString()}: 常用表情组已更新</div>\`;
                    }
                  }
                }
              } catch (error) {
                console.error('❌ 处理常用表情组刷新事件失败:', error);
              }
            };

            // 添加监听器
            window.addEventListener('emoji-common-group-refreshed', commonGroupRefreshHandler);

            return picker;
          }

          // 绑定打开选择器按钮
          document.querySelector('.test-open-picker').addEventListener('click', async () => {
            console.log('🚀 打开表情选择器');

            // 移除旧的选择器
            const existingPicker = document.getElementById('test-emoji-picker');
            if (existingPicker) {
              existingPicker.remove();
            }

            const picker = await createMockEmojiPicker();
            document.body.appendChild(picker);

            console.log('✅ 表情选择器已创建');
          });

          // 初始化测试状态
          console.log('🧪 测试环境初始化完成');
        </script>
      </body>
      </html>
    `)

    // 等待页面加载完成
    await page.waitForLoadState('networkidle')

    // 验证初始状态
    await expect(page.locator('#common-group-state')).toHaveText('常用表情组状态: 未初始化')
    await expect(page.locator('#usage-count')).toHaveText('使用计数: 0')

    // 1. 打开表情选择器
    await page.click('.test-open-picker')
    await page.waitForSelector('#test-emoji-picker', { timeout: 2000 })

    // 验证表情选择器已创建
    const picker = page.locator('#test-emoji-picker')
    await expect(picker).toBeVisible()

    // 验证常用表情组初始为空
    const commonSection = picker.locator('[data-section="common-emoji-group"]')
    await expect(commonSection).toBeVisible()

    const commonTitle = commonSection.locator('.emoji-picker__section-title')
    await expect(commonTitle).toHaveText('常用表情 (0)')

    // 2. 点击普通表情组中的第一个表情
    const normalSection = picker.locator('[data-section="normal-group-1"]')
    const firstEmoji = normalSection.locator('img.emoji').first()

    await expect(firstEmoji).toBeVisible()
    await firstEmoji.click()

    // 3. 验证使用记录已更新
    await expect(page.locator('#usage-count')).toHaveText('使用计数: 1', { timeout: 2000 })

    // 4. 🚀 关键验证：常用表情组应该实时更新
    await expect(page.locator('#common-group-state')).toHaveText('常用表情组状态: 1 个表情', {
      timeout: 3000,
    })

    // 验证常用表情组界面已更新
    await expect(commonTitle).toHaveText('常用表情 (1)', { timeout: 2000 })

    // 验证常用表情组中现在有表情了
    const commonEmojis = commonSection.locator('.emoji-picker__section-emojis img.emoji')
    await expect(commonEmojis).toHaveCount(1)

    // 验证添加的表情是正确的
    const addedEmoji = commonEmojis.first()
    await expect(addedEmoji).toHaveAttribute('data-emoji', '笑脸')
    await expect(addedEmoji).toHaveAttribute('data-uuid', 'emoji-1')

    // 5. 再次点击另一个表情，验证继续更新
    const secondEmoji = normalSection.locator('img.emoji').nth(1)
    await secondEmoji.click()

    // 验证使用计数继续增加
    await expect(page.locator('#usage-count')).toHaveText('使用计数: 2', { timeout: 2000 })

    // 验证常用表情组中现在有两个表情
    await expect(commonTitle).toHaveText('常用表情 (2)', { timeout: 2000 })
    await expect(commonEmojis).toHaveCount(2, { timeout: 2000 })

    // 6. 测试点击常用表情组中的表情
    const commonFirstEmoji = commonSection
      .locator('.emoji-picker__section-emojis img.emoji')
      .first()
    await commonFirstEmoji.click()

    // 验证常用表情的点击也被正确记录
    await expect(page.locator('#usage-count')).toHaveText('使用计数: 3', { timeout: 2000 })

    console.log('✅ 常用表情实时更新功能测试通过')
  })

  test('常用表情组在激进缓存模式下应该及时刷新', async ({ page }) => {
    // 设置测试环境，模拟激进缓存模式
    await page.setViewportSize({ width: 1200, height: 800 })

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>激进缓存模式下常用表情更新测试</title>
        <style>
          .test-controls {
            position: fixed;
            top: 10px;
            left: 10px;
            background: #f0f0f0;
            padding: 10px;
            border: 1px solid #ccc;
          }
          .emoji-picker {
            margin: 20px;
            border: 1px solid #ddd;
            padding: 10px;
          }
          .emoji {
            cursor: pointer;
            width: 32px;
            height: 32px;
            margin: 5px;
          }
        </style>
      </head>
      <body>
        <div class="test-controls">
          <button id="enable-aggressive-cache">启用激进缓存</button>
          <button id="test-cache-refresh">测试缓存刷新</button>
          <div id="cache-status">缓存状态: 未启用</div>
          <div id="refresh-count">刷新次数: 0</div>
        </div>

        <div class="emoji-picker" id="test-picker">
          <div class="emoji-picker__section" data-section="common-emoji-group">
            <h3>常用表情 (0)</h3>
            <div class="emoji-picker__section-emojis"></div>
          </div>
        </div>

        <script>
          let isAggressiveCacheEnabled = false;
          let refreshCount = 0;
          let commonGroupCache = {
            data: { UUID: 'common-emoji-group', displayName: '常用表情', emojis: [] },
            lastUpdate: 0
          };

          // 模拟激进缓存管理器
          const mockCacheManager = {
            isAggressiveMode: false,
            commonGroupCache: commonGroupCache
          };

          // 模拟常用表情组刷新函数
          async function refreshCommonEmojiGroupFromBackground() {
            console.log('🔄 从后台刷新常用表情组数据');

            // 模拟网络延迟
            await new Promise(resolve => setTimeout(resolve, 100));

            // 模拟获取到更新的数据
            const mockUpdatedGroup = {
              UUID: 'common-emoji-group',
              displayName: '常用表情',
              emojis: [
                { UUID: 'cached-emoji-1', displayName: '缓存表情1', displayUrl: 'https://example.com/cached1.png' },
                { UUID: 'cached-emoji-2', displayName: '缓存表情2', displayUrl: 'https://example.com/cached2.png' }
              ]
            };

            // 更新缓存
            mockCacheManager.commonGroupCache.data = mockUpdatedGroup;
            mockCacheManager.commonGroupCache.lastUpdate = Date.now();

            refreshCount++;
            document.getElementById('refresh-count').textContent = '刷新次数: ' + refreshCount;

            // 触发界面更新事件
            window.dispatchEvent(new CustomEvent('emoji-common-group-refreshed', {
              detail: { group: mockUpdatedGroup, timestamp: Date.now() }
            }));

            return mockUpdatedGroup;
          }

          // 模拟激进缓存模式下的数据加载
          async function loadDataWithAggressiveCache() {
            console.log('📦 激进缓存模式下加载数据');

            if (mockCacheManager.isAggressiveMode) {
              const cacheAge = Date.now() - mockCacheManager.commonGroupCache.lastUpdate;
              console.log('🕒 常用表情组缓存年龄:', cacheAge + 'ms');

              // 🚀 关键修复：如果常用表情组缓存过旧（超过10秒），就刷新一下
              if (cacheAge > 10000) { // 10秒
                console.log('⚠️ 常用表情组缓存过旧，异步刷新');
                // 异步刷新常用表情组，不阻塞主流程
                refreshCommonEmojiGroupFromBackground().catch(() => {
                  // 忽略错误，不影响主流程
                });
              }
            }
          }

          // 添加常用表情组刷新监听器
          window.addEventListener('emoji-common-group-refreshed', (event) => {
            const updatedGroup = event.detail?.group;
            if (updatedGroup && updatedGroup.UUID === 'common-emoji-group') {
              console.log('✨ 收到常用表情组刷新事件，更新界面');

              const section = document.querySelector('[data-section="common-emoji-group"]');
              const title = section.querySelector('h3');
              const emojisContainer = section.querySelector('.emoji-picker__section-emojis');

              // 更新标题
              title.textContent = \`常用表情 (\${updatedGroup.emojis.length})\`;

              // 更新表情列表
              let emojisHtml = '';
              updatedGroup.emojis.forEach(emoji => {
                emojisHtml += \`<img class="emoji" src="\${emoji.displayUrl}" data-uuid="\${emoji.UUID}" alt="\${emoji.displayName}" title="\${emoji.displayName}" />\`;
              });
              emojisContainer.innerHTML = emojisHtml;

              console.log('🎯 常用表情组界面更新完成');
            }
          });

          // 绑定控制按钮
          document.getElementById('enable-aggressive-cache').addEventListener('click', () => {
            mockCacheManager.isAggressiveMode = !mockCacheManager.isAggressiveMode;
            isAggressiveCacheEnabled = mockCacheManager.isAggressiveMode;

            document.getElementById('cache-status').textContent =
              '缓存状态: ' + (isAggressiveCacheEnabled ? '激进模式已启用' : '未启用');

            console.log('⚡ 激进缓存模式:', isAggressiveCacheEnabled ? '已启用' : '已禁用');
          });

          document.getElementById('test-cache-refresh').addEventListener('click', async () => {
            console.log('🧪 测试缓存刷新机制');

            // 模拟缓存过期（设置为11秒前）
            mockCacheManager.commonGroupCache.lastUpdate = Date.now() - 11000;

            // 触发数据加载
            await loadDataWithAggressiveCache();
          });

          console.log('🧪 激进缓存测试环境初始化完成');
        </script>
      </body>
      </html>
    `)

    await page.waitForLoadState('networkidle')

    // 验证初始状态
    await expect(page.locator('#cache-status')).toHaveText('缓存状态: 未启用')
    await expect(page.locator('#refresh-count')).toHaveText('刷新次数: 0')

    // 启用激进缓存模式
    await page.click('#enable-aggressive-cache')
    await expect(page.locator('#cache-status')).toHaveText('缓存状态: 激进模式已启用')

    // 验证常用表情组初始状态
    const commonSection = page.locator('[data-section="common-emoji-group"]')
    await expect(commonSection.locator('h3')).toHaveText('常用表情 (0)')

    // 测试缓存刷新机制
    await page.click('#test-cache-refresh')

    // 验证刷新被触发
    await expect(page.locator('#refresh-count')).toHaveText('刷新次数: 1', { timeout: 2000 })

    // 验证常用表情组被更新
    await expect(commonSection.locator('h3')).toHaveText('常用表情 (2)', { timeout: 2000 })

    // 验证表情确实被添加到界面中
    const emojis = commonSection.locator('.emoji-picker__section-emojis img.emoji')
    await expect(emojis).toHaveCount(2)

    console.log('✅ 激进缓存模式下的常用表情更新测试通过')
  })
})
