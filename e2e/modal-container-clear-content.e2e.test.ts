import { test, expect } from '@playwright/test'

test.describe('表情选择器 modal-container 内容清空功能验证', () => {
  test('移动端模式下关闭表情选择器应该清空 modal-container 内容而保留容器', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 创建测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>modal-container 内容清空测试</title>
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
          }
          .modal.d-modal.fk-d-menu-modal.emoji-picker-content {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            padding: 20px;
            z-index: 10001;
          }
          .emoji-picker__close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <button class="test-open-picker">打开表情选择器</button>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>

        <script>
          function isMobileMode() {
            return window.innerWidth <= 768;
          }

          // 模拟新的 closePicker 函数
          function closePicker(picker, isMobilePicker) {
            if (isMobilePicker) {
              const modalContainer = picker.closest('.modal-container');
              if (modalContainer) {
                modalContainer.innerHTML = '';
                console.log('清空移动端模态容器内容');
              } else {
                picker.remove();
              }
            } else {
              picker.remove();
            }
          }

          document.querySelector('.test-open-picker').addEventListener('click', function() {
            const isMobilePicker = isMobileMode();

            // 检查是否已存在 modal-container
            let modalContainer = document.querySelector('.modal-container');
            if (modalContainer) {
              if (modalContainer.innerHTML.trim() === '') {
                // 如果存在但为空，重新创建内容
                // 继续执行下面的创建逻辑
              } else {
                // 如果已有内容，则清空
                modalContainer.innerHTML = '';
                return;
              }
            }

            if (isMobilePicker) {
              // 创建或重用 modal-container
              if (!modalContainer) {
                modalContainer = document.createElement('div');
                modalContainer.className = 'modal-container';
                document.body.appendChild(modalContainer);
              }

              modalContainer.innerHTML = \`
                <div class="modal d-modal fk-d-menu-modal emoji-picker-content">
                  <div class="d-modal__container">
                    <div class="d-modal__body">
                      <div class="emoji-picker">
                        <div class="emoji-picker__filter-container">
                          <button class="emoji-picker__close-btn" type="button">✕</button>
                        </div>
                        <div class="emoji-picker__content">
                          <div class="emoji-picker__sections">
                            <div class="emoji-picker__section-emojis">
                              <img class="emoji" src="/test-emoji.png" data-emoji="test" alt="test" title=":test:">
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="d-modal__backdrop"></div>
              \`;

              // 添加事件处理
              const closeButton = modalContainer.querySelector('.emoji-picker__close-btn');
              const backdrop = modalContainer.querySelector('.d-modal__backdrop');
              const picker = modalContainer.querySelector('.emoji-picker');

              if (closeButton) {
                closeButton.addEventListener('click', () => {
                  closePicker(picker, isMobilePicker);
                });
              }

              if (backdrop) {
                backdrop.addEventListener('click', () => {
                  closePicker(picker, isMobilePicker);
                });
              }

              // 表情点击事件
              const emojiImg = modalContainer.querySelector('.emoji');
              if (emojiImg) {
                emojiImg.addEventListener('click', () => {
                  // 模拟插入表情
                  const textArea = document.querySelector('.d-editor-input');
                  if (textArea) {
                    textArea.value += ':test: ';
                  }
                  closePicker(picker, isMobilePicker);
                });
              }

              console.log('创建移动端模态容器内容');
            }
          });
        </script>
      </body>
      </html>
    `)

    // 初始状态：没有 modal-container
    let modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).not.toBeVisible()

    // 第一次点击：创建 modal-container
    await page.click('.test-open-picker')
    modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // 验证 modal-container 在 DOM 中存在且有内容
    const modalContainerCount = await page.locator('.modal-container').count()
    expect(modalContainerCount).toBe(1)

    const initialInnerHTML = await modalContainer.evaluate((el) => el.innerHTML)
    expect(initialInnerHTML.trim()).not.toBe('')

    // 点击关闭按钮：应该清空内容而不是销毁容器
    const closeButton = await page.locator('.emoji-picker__close-btn')
    await closeButton.click()

    // 验证 modal-container 仍然在 DOM 中，但内容被清空
    const modalContainerCountAfterClose = await page.locator('.modal-container').count()
    expect(modalContainerCountAfterClose).toBe(1) // 仍然存在

    // 验证内容被清空
    const innerHTML = await modalContainer.evaluate((el) => el.innerHTML)
    expect(innerHTML.trim()).toBe('')

    // 第二次点击：应该重新创建内容
    await page.click('.test-open-picker')

    // 验证内容被重新创建
    const innerHTMLAfterReopen = await modalContainer.evaluate((el) => el.innerHTML)
    expect(innerHTMLAfterReopen.trim()).not.toBe('')

    // 验证仍然只有一个 modal-container
    const modalContainerCountAfterReopen = await page.locator('.modal-container').count()
    expect(modalContainerCountAfterReopen).toBe(1)

    // 点击背景遮罩：同样应该清空内容而不是销毁
    const backdrop = await page.locator('.d-modal__backdrop')
    await backdrop.click()

    // 验证 modal-container 仍然存在但内容被清空
    const modalContainerCountAfterBackdrop = await page.locator('.modal-container').count()
    expect(modalContainerCountAfterBackdrop).toBe(1)

    const innerHTMLAfterBackdrop = await modalContainer.evaluate((el) => el.innerHTML)
    expect(innerHTMLAfterBackdrop.trim()).toBe('')

    console.log('✅ modal-container 内容清空功能验证通过')
  })

  test('点击表情插入后应该清空内容而保留容器', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // 使用相同的测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>表情插入后清空测试</title>
        <style>
          .modal-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; }
          .emoji { cursor: pointer; width: 32px; height: 32px; }
        </style>
      </head>
      <body>
        <button class="test-open-picker">打开表情选择器</button>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>

        <script>
          function closePicker(picker, isMobilePicker) {
            if (isMobilePicker) {
              const modalContainer = picker.closest('.modal-container');
              if (modalContainer) {
                modalContainer.innerHTML = '';
              } else {
                picker.remove();
              }
            } else {
              picker.remove();
            }
          }

          document.querySelector('.test-open-picker').addEventListener('click', function() {
            let modalContainer = document.querySelector('.modal-container');
            if (!modalContainer) {
              modalContainer = document.createElement('div');
              modalContainer.className = 'modal-container';
              modalContainer.innerHTML = \`
                <div class="modal d-modal fk-d-menu-modal emoji-picker-content">
                  <div class="emoji-picker">
                    <div class="emoji-picker__section-emojis">
                      <img class="emoji" src="/test-emoji.png" data-emoji="test" alt="test" title=":test:">
                    </div>
                  </div>
                </div>
                <div class="d-modal__backdrop"></div>
              \`;

              const emojiImg = modalContainer.querySelector('.emoji');
              const picker = modalContainer.querySelector('.emoji-picker');
              if (emojiImg) {
                emojiImg.addEventListener('click', () => {
                  const textArea = document.querySelector('.d-editor-input');
                  if (textArea) {
                    textArea.value += ':test: ';
                  }
                  closePicker(picker, true); // 传入 isMobilePicker = true
                });
              }

              document.body.appendChild(modalContainer);
            }
          });
        </script>
      </body>
      </html>
    `)

    // 打开表情选择器
    await page.click('.test-open-picker')
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).toBeVisible()

    // 获取初始文本框内容
    const textArea = await page.locator('.d-editor-input')
    const initialContent = await textArea.inputValue()

    // 点击表情
    const emojiImg = await page.locator('.emoji')
    await emojiImg.click()

    // 验证表情被插入
    const finalContent = await textArea.inputValue()
    expect(finalContent).toBe(initialContent + ':test: ')

    // 验证 modal-container 存在但内容被清空
    const modalContainerCount = await page.locator('.modal-container').count()
    expect(modalContainerCount).toBe(1)

    // 验证内容被清空
    const innerHTML = await modalContainer.evaluate((el) => el.innerHTML)
    expect(innerHTML.trim()).toBe('')

    console.log('✅ 表情插入后内容清空功能验证通过')
  })

  test('桌面端模式下应该继续使用销毁方式', async ({ page }) => {
    // 设置桌面端视口
    await page.setViewportSize({ width: 1024, height: 768 })

    // 创建桌面端测试页面
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>桌面端销毁测试</title>
        <style>
          .emoji-picker { position: fixed; background: white; border: 1px solid #ddd; padding: 20px; }
          .emoji { cursor: pointer; width: 32px; height: 32px; }
        </style>
      </head>
      <body>
        <button class="test-open-picker">打开表情选择器</button>
        <textarea class="d-editor-input" placeholder="在此输入..."></textarea>

        <script>
          function isMobileMode() {
            return window.innerWidth <= 768;
          }

          function closePicker(picker, isMobilePicker) {
            if (isMobilePicker) {
              const modalContainer = picker.closest('.modal-container');
              if (modalContainer) {
                modalContainer.innerHTML = '';
              } else {
                picker.remove();
              }
            } else {
              picker.remove(); // 桌面端直接销毁
            }
          }

          document.querySelector('.test-open-picker').addEventListener('click', function() {
            const isMobilePicker = isMobileMode();

            if (!isMobilePicker) {
              // 桌面端模式
              const picker = document.createElement('div');
              picker.className = 'emoji-picker';
              picker.innerHTML = \`
                <div class="emoji-picker__section-emojis">
                  <img class="emoji" src="/test-emoji.png" data-emoji="test" alt="test" title=":test:">
                </div>
                <button class="close-btn">关闭</button>
              \`;

              const emojiImg = picker.querySelector('.emoji');
              const closeBtn = picker.querySelector('.close-btn');

              if (emojiImg) {
                emojiImg.addEventListener('click', () => {
                  const textArea = document.querySelector('.d-editor-input');
                  if (textArea) {
                    textArea.value += ':test: ';
                  }
                  closePicker(picker, isMobilePicker);
                });
              }

              if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                  closePicker(picker, isMobilePicker);
                });
              }

              document.body.appendChild(picker);
            }
          });
        </script>
      </body>
      </html>
    `)

    // 打开表情选择器
    await page.click('.test-open-picker')
    const picker = await page.locator('.emoji-picker')
    await expect(picker).toBeVisible()

    // 验证没有 modal-container
    const modalContainer = await page.locator('.modal-container')
    await expect(modalContainer).not.toBeVisible()

    // 点击表情
    const emojiImg = await page.locator('.emoji')
    await emojiImg.click()

    // 验证表情选择器被完全销毁
    await expect(picker).not.toBeVisible()
    const pickerCount = await page.locator('.emoji-picker').count()
    expect(pickerCount).toBe(0)

    console.log('✅ 桌面端销毁功能验证通过')
  })
})
