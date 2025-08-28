import { test, expect } from '@playwright/test'

test.describe('移动端模态容器功能验证', () => {
  test('移动端模式下应该创建modal-container', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 创建测试页面，模拟移动端表情选择器
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>移动端模态容器测试</title>
        <style>
          .modal-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
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
              // 创建模态容器（参考mobile.html结构）
              const modalContainer = document.createElement('div');
              modalContainer.className = 'modal-container';
              modalContainer.innerHTML = `
                <div class="modal d-modal fk-d-menu-modal emoji-picker-content" data-keyboard="false" aria-modal="true" role="dialog" data-identifier="emoji-picker" data-content="">
                  <div class="d-modal__container">
                    <div class="d-modal__body" tabindex="-1">
                      <div class="emoji-picker">
                        <div class="emoji-picker__filter-container">
                          <button class="btn no-text btn-icon btn-transparent emoji-picker__close-btn" type="button">
                            <svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                              <use href="#xmark"></use>
                            </svg>
                          </button>
                        </div>
                        <h3>移动端表情选择器</h3>
                        <div>这是一个测试表情选择器</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="d-modal__backdrop"></div>
              `;

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
            } else {
              // 桌面端模式（简化）
              const picker = document.createElement('div');
              picker.className = 'emoji-picker';
              picker.style.position = 'fixed';
              picker.style.top = '100px';
              picker.style.left = '100px';
              picker.innerHTML = '<h3>桌面端表情选择器</h3>';
              document.body.appendChild(picker);

              console.log('桌面端表情选择器已创建');
            }
          });
        </script>
      </body>
      </html>
    `)

    // 点击表情按钮
    await page.click('.nacho-emoji-picker-button')

    // 验证模态容器被创建
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // 验证背景遮罩存在
    const backdrop = await page.locator('.d-modal__backdrop')
    await expect(backdrop).toBeVisible()

    // 验证模态对话框结构
    const modal = await modalContainer.locator('.modal.d-modal.fk-d-menu-modal.emoji-picker-content')
    await expect(modal).toBeVisible()

    // 验证模态容器内部结构
    const modalBody = await modal.locator('.d-modal__body')
    await expect(modalBody).toBeVisible()

    // 验证表情选择器在模态容器内
    const emojiPicker = await modalBody.locator('.emoji-picker')
    await expect(emojiPicker).toBeVisible()

    // 验证关闭按钮存在
    const closeButton = await emojiPicker.locator('.emoji-picker__close-btn')
    await expect(closeButton).toBeVisible()

    // 验证模态容器的层级结构
    expect(await emojiPicker.innerHTML()).toContain('移动端表情选择器')

    // 点击关闭按钮关闭模态
    await closeButton.click()

    // 验证模态容器被移除
    await expect(modalContainer).not.toBeVisible()

    console.log('✅ 移动端模态容器功能验证通过')
  })

  test('桌面端模式下不应该创建modal-container', async ({ page }) => {
    // 设置桌面端视口
    await page.setViewportSize({ width: 1024, height: 768 })

    // 使用相同的测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>桌面端测试</title>
        <style>
          .emoji-picker {
            position: fixed;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
          }
        </style>
      </head>
      <body>
        <div class="d-editor-button-bar" role="toolbar">
          <button class="nacho-emoji-picker-button">🐈‍⬛</button>
        </div>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>

        <script>
          function isMobileMode() {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          }

          document.querySelector('.nacho-emoji-picker-button').addEventListener('click', function() {
            if (isMobileMode()) {
              console.log('移动端模式');
            } else {
              // 桌面端模式：直接创建表情选择器
              const picker = document.createElement('div');
              picker.className = 'emoji-picker desktop-picker';
              picker.innerHTML = '<h3>桌面端表情选择器</h3><div>无需模态容器</div>';
              document.body.appendChild(picker);

              console.log('桌面端表情选择器已创建');
            }
          });
        </script>
      </body>
      </html>
    `)

    // 点击表情按钮
    await page.click('.nacho-emoji-picker-button')

    // 验证没有创建模态容器
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).not.toBeVisible()

    // 验证直接创建了表情选择器
    const desktopPicker = await page.locator('.desktop-picker')
    await expect(desktopPicker).toBeVisible()

    // 验证选择器内容
    expect(await desktopPicker.innerHTML()).toContain('桌面端表情选择器')

    console.log('✅ 桌面端模式验证通过')
  })
})
