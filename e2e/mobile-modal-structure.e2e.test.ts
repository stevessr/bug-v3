import { test, expect } from '@playwright/test'

test.describe('移动端表情选择器模态结构验证', () => {
  test('移动端模式下应该创建正确的模态结构', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 创建测试页面，模拟移动端表情选择器
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>移动端模态结构测试</title>
        <style>
          .modal-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
          }
          .modal.d-modal.fk-d-menu-modal.emoji-picker-content {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 400px;
            max-height: 80vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            z-index: 10001;
          }
          .d-modal__backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
          }
          .d-modal__container {
            width: 100%;
            height: 100%;
          }
          .d-modal__body {
            padding: 20px;
            max-height: 80vh;
            overflow-y: auto;
          }
          .emoji-picker__close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="d-editor-button-bar" role="toolbar">
          <button class="nacho-emoji-picker-button">🐈‍⬛</button>
        </div>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>

        <script>
          // 模拟移动端检测
          function isMobileMode() {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          }

          document.querySelector('.nacho-emoji-picker-button').addEventListener('click', function() {
            // 检查是否已存在模态容器
            let existingModal = document.querySelector('.modal-container');
            if (existingModal) {
              existingModal.remove();
              return;
            }

            if (isMobileMode()) {
              // 创建移动端模态容器（严格按照mobile.html参考结构）
              const modalContainer = document.createElement('div');
              modalContainer.className = 'modal-container';
              modalContainer.innerHTML = \`
                <div class="modal d-modal fk-d-menu-modal emoji-picker-content" data-keyboard="false" aria-modal="true" role="dialog" data-identifier="emoji-picker" data-content="">
                  <div class="d-modal__container">
                    <div class="d-modal__body" tabindex="-1">
                      <div class="emoji-picker">
                        <div class="emoji-picker__filter-container">
                          <div class="emoji-picker__filter filter-input-container">
                            <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
                          </div>
                          <button class="btn no-text btn-icon btn-transparent emoji-picker__close-btn" type="button">
                            <svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                              <use href="#xmark"></use>
                            </svg>
                            <span aria-hidden="true">&ZeroWidthSpace;</span>
                          </button>
                        </div>
                        <div class="emoji-picker__content">
                          <div class="emoji-picker__sections-nav">
                            <button class="btn no-text btn-flat emoji-picker__section-btn active" data-section="favorites" type="button">
                              <span style="font-size: 20px;">⭐</span>
                            </button>
                          </div>
                          <div class="emoji-picker__scrollable-content">
                            <div class="emoji-picker__sections" role="button">
                              <div class="emoji-picker__section" data-section="favorites" role="region" aria-label="常用">
                                <div class="emoji-picker__section-title-container">
                                  <h2 class="emoji-picker__section-title">常用</h2>
                                </div>
                                <div class="emoji-picker__section-emojis">
                                  <img width="32" height="32" class="emoji" src="/test-emoji.png" data-emoji="test" alt="test" title=":test:" loading="lazy" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="d-modal__backdrop"></div>
              \`;

              // 添加关闭按钮事件
              const closeButton = modalContainer.querySelector('.emoji-picker__close-btn');
              if (closeButton) {
                closeButton.addEventListener('click', function() {
                  modalContainer.remove();
                });
              }

              // 添加背景遮罩事件
              const backdrop = modalContainer.querySelector('.d-modal__backdrop');
              if (backdrop) {
                backdrop.addEventListener('click', function() {
                  modalContainer.remove();
                });
              }

              // 防止模态内容点击事件冒泡
              const modalContent = modalContainer.querySelector('.d-modal__container');
              if (modalContent) {
                modalContent.addEventListener('click', function(e) {
                  e.stopPropagation();
                });
              }

              document.body.appendChild(modalContainer);
              console.log('移动端模态容器已创建');
            }
          });
        </script>
      </body>
      </html>
    `)

    // 点击表情按钮
    await page.click('.nacho-emoji-picker-button')

    // 验证模态容器结构
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // 验证模态对话框
    const modal = await page.locator('.modal.d-modal.fk-d-menu-modal.emoji-picker-content')
    await expect(modal).toBeVisible()
    expect(await modal.getAttribute('aria-modal')).toBe('true')
    expect(await modal.getAttribute('role')).toBe('dialog')
    expect(await modal.getAttribute('data-identifier')).toBe('emoji-picker')

    // 验证模态容器内部结构
    const modalContainer_inner = await modal.locator('.d-modal__container')
    await expect(modalContainer_inner).toBeVisible()

    const modalBody = await modalContainer_inner.locator('.d-modal__body')
    await expect(modalBody).toBeVisible()
    expect(await modalBody.getAttribute('tabindex')).toBe('-1')

    // 验证表情选择器结构
    const emojiPicker = await modalBody.locator('.emoji-picker')
    await expect(emojiPicker).toBeVisible()

    // 验证过滤容器
    const filterContainer = await emojiPicker.locator('.emoji-picker__filter-container')
    await expect(filterContainer).toBeVisible()

    // 验证搜索输入框
    const filterInput = await filterContainer.locator('.filter-input')
    await expect(filterInput).toBeVisible()
    expect(await filterInput.getAttribute('placeholder')).toBe('按表情符号名称和别名搜索…')

    // 验证关闭按钮
    const closeButton = await filterContainer.locator('.emoji-picker__close-btn')
    await expect(closeButton).toBeVisible()

    // 验证内容区域
    const content = await emojiPicker.locator('.emoji-picker__content')
    await expect(content).toBeVisible()

    // 验证导航按钮
    const sectionsNav = await content.locator('.emoji-picker__sections-nav')
    await expect(sectionsNav).toBeVisible()

    const sectionBtn = await sectionsNav.locator('.emoji-picker__section-btn')
    await expect(sectionBtn).toBeVisible()
    expect(await sectionBtn.getAttribute('data-section')).toBe('favorites')

    // 验证可滚动内容
    const scrollableContent = await content.locator('.emoji-picker__scrollable-content')
    await expect(scrollableContent).toBeVisible()

    // 验证表情分组
    const sections = await scrollableContent.locator('.emoji-picker__sections')
    await expect(sections).toBeVisible()
    expect(await sections.getAttribute('role')).toBe('button')

    const section = await sections.locator('.emoji-picker__section')
    await expect(section).toBeVisible()
    expect(await section.getAttribute('data-section')).toBe('favorites')
    expect(await section.getAttribute('role')).toBe('region')

    // 验证背景遮罩
    const backdrop = await page.locator('.d-modal__backdrop')
    await expect(backdrop).toBeVisible()

    // 测试关闭按钮功能
    await closeButton.click()
    await expect(modalContainer).not.toBeVisible()

    console.log('✅ 移动端模态结构验证通过')
  })

  test('背景遮罩点击应该关闭模态', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 使用相同的测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>背景遮罩测试</title>
        <style>
          .modal-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; }
          .d-modal__backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; }
        </style>
      </head>
      <body>
        <button class="test-btn">打开模态</button>
        <script>
          document.querySelector('.test-btn').addEventListener('click', function() {
            const modalContainer = document.createElement('div');
            modalContainer.className = 'modal-container';
            modalContainer.innerHTML = \`
              <div class="modal d-modal fk-d-menu-modal emoji-picker-content">
                <div class="d-modal__container">
                  <div class="d-modal__body">
                    <div>模态内容</div>
                  </div>
                </div>
              </div>
              <div class="d-modal__backdrop"></div>
            \`;

            const backdrop = modalContainer.querySelector('.d-modal__backdrop');
            backdrop.addEventListener('click', function() {
              modalContainer.remove();
            });

            const modalContent = modalContainer.querySelector('.d-modal__container');
            modalContent.addEventListener('click', function(e) {
              e.stopPropagation();
            });

            document.body.appendChild(modalContainer);
          });
        </script>
      </body>
      </html>
    `)

    // 打开模态
    await page.click('.test-btn')
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // 点击背景遮罩
    const backdrop = await page.locator('.d-modal__backdrop')
    await backdrop.click()

    // 验证模态被关闭
    await expect(modalContainer).not.toBeVisible()

    console.log('✅ 背景遮罩点击关闭功能验证通过')
  })

  test('模态内容点击不应该关闭模态', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 使用相同的测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>模态内容点击测试</title>
        <style>
          .modal-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; }
          .d-modal__backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); }
          .d-modal__container { position: relative; z-index: 10001; background: white; margin: 50px; padding: 20px; }
        </style>
      </head>
      <body>
        <button class="test-btn">打开模态</button>
        <script>
          document.querySelector('.test-btn').addEventListener('click', function() {
            const modalContainer = document.createElement('div');
            modalContainer.className = 'modal-container';
            modalContainer.innerHTML = \`
              <div class="d-modal__backdrop"></div>
              <div class="d-modal__container">
                <div class="d-modal__body">
                  <div class="modal-content">点击这里不应该关闭模态</div>
                </div>
              </div>
            \`;

            const backdrop = modalContainer.querySelector('.d-modal__backdrop');
            backdrop.addEventListener('click', function() {
              modalContainer.remove();
            });

            const modalContent = modalContainer.querySelector('.d-modal__container');
            modalContent.addEventListener('click', function(e) {
              e.stopPropagation();
            });

            document.body.appendChild(modalContainer);
          });
        </script>
      </body>
      </html>
    `)

    // 打开模态
    await page.click('.test-btn')
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // 点击模态内容
    const modalContent = await page.locator('.modal-content')
    await modalContent.click()

    // 验证模态仍然显示
    await expect(modalContainer).toBeVisible()

    console.log('✅ 模态内容点击不关闭功能验证通过')
  })
})
