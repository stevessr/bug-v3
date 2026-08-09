import { expect, test } from '@playwright/test'

test.describe('PI agent visual context', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-active-panel', 'agent')
      Object.defineProperty(window, 'chrome', {
        configurable: true,
        value: {
          runtime: {
            getURL(path: string) {
              return new URL(`/${path}`, location.origin).toString()
            },
            async sendMessage(message: { type?: string }) {
              if (message.type === 'AGENT_RECORDING_STATUS') {
                return { success: true, data: null }
              }
              if (message.type === 'CAPTURE_SCREENSHOT') {
                const canvas = document.createElement('canvas')
                canvas.width = 320
                canvas.height = 180
                const context = canvas.getContext('2d')!
                context.fillStyle = '#6750a4'
                context.fillRect(0, 0, 320, 180)
                context.fillStyle = '#ffffff'
                context.font = '24px sans-serif'
                context.fillText('Visual context', 54, 96)
                return { success: true, data: canvas.toDataURL('image/png') }
              }
              return { success: true, data: null }
            }
          },
          tabs: {
            async query() {
              return [
                {
                  id: 21,
                  url: 'https://forum.example.com/latest',
                  title: 'Forum',
                  active: true,
                  windowId: 1
                }
              ]
            },
            async get() {
              return {
                id: 21,
                url: 'https://forum.example.com/latest',
                title: 'Forum',
                status: 'complete',
                active: true,
                windowId: 1
              }
            }
          }
        }
      })
    })
  })

  test('captures a visible-tab region and adds it to the private attachment tray', async ({
    page
  }) => {
    await page.setViewportSize({ width: 420, height: 900 })
    await page.goto('/?mode=sidebar')

    await page.getByTestId('agent-screenshot-context').click()
    const modal = page.getByRole('dialog', { name: '共享视觉上下文' })
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('图片只发送给本次模型请求')

    const image = modal.getByAltText('待共享的页面截图')
    await image.hover({ position: { x: 20, y: 20 } })
    const box = await image.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width - 20, box!.y + box!.height - 20, { steps: 4 })
    await page.mouse.up()
    const addSelection = modal.getByRole('button', { name: '添加选区' })
    await expect(addSelection).toBeEnabled()
    await addSelection.click()

    const tray = page.getByTestId('agent-image-attachment-tray')
    await expect(tray).toBeVisible()
    await expect(tray).toContainText('页面选区.png')
    await expect(page.getByRole('button', { name: /发\s*送/ })).toBeEnabled()
  })

  test('accepts an uploaded image but persists only attachment metadata', async ({ page }) => {
    await page.goto('/?mode=sidebar')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    )
    await page.getByTestId('agent-image-file-input').setInputFiles({
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: png
    })

    const tray = page.getByTestId('agent-image-attachment-tray')
    await expect(tray).toContainText('reference.png')
    await page.getByPlaceholder('描述任务，或输入 / 运行工作流...').fill('分析这个参考图')
    await page.getByRole('button', { name: /发\s*送/ }).click()
    await expect(page.getByText('分析这个参考图', { exact: true })).toBeVisible()

    const stored = await page.evaluate(() => localStorage.getItem('ai-agent-messages-v1') || '')
    expect(stored).toContain('reference.png')
    expect(stored).not.toContain('iVBORw0KGgo')
    expect(stored).not.toContain('data:image')
  })
})
