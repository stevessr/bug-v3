import { expect, test } from '@playwright/test'

const WORKFLOW_STORAGE_KEY = 'ai-agent-browser-workflows-v1'
const SCHEDULE_STORAGE_KEY = 'ai-agent-workflow-schedules-v1'

test.describe('PI agent recorded workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ workflowKey, scheduleKey }) => {
        localStorage.setItem('sidebar-active-panel', 'agent')
        const now = Date.now()
        localStorage.setItem(
          workflowKey,
          JSON.stringify([
            {
              id: 'workflow-search',
              name: '搜索论坛更新',
              shortcut: 'search-forum',
              createdAt: now,
              updatedAt: now,
              startUrl: 'https://forum.example.com/latest',
              startTitle: 'Example Forum',
              actions: [
                {
                  id: 'input-search',
                  type: 'input',
                  selector: 'input[name="q"]',
                  text: 'Vite 8',
                  clear: true,
                  note: '填写搜索框'
                },
                { id: 'submit-search', type: 'key', key: 'Enter', note: '提交搜索' }
              ],
              redactedFields: []
            },
            {
              id: 'workflow-login',
              name: '登录流程',
              shortcut: 'login',
              createdAt: now - 1,
              updatedAt: now - 1,
              startUrl: 'https://forum.example.com/login',
              actions: [{ id: 'click-login', type: 'click-dom', selector: '#login' }],
              redactedFields: [
                {
                  selector: '#password',
                  label: '密码',
                  url: 'https://forum.example.com/login',
                  recordedAt: now
                }
              ]
            }
          ])
        )
        localStorage.setItem(
          scheduleKey,
          JSON.stringify([
            {
              id: 'schedule-search',
              workflowId: 'workflow-search',
              enabled: true,
              intervalMinutes: 60,
              nextRunAt: now + 60 * 60 * 1000,
              allowedOrigins: ['https://forum.example.com'],
              closeTabWhenDone: true,
              createdAt: now,
              updatedAt: now
            }
          ])
        )
      },
      { workflowKey: WORKFLOW_STORAGE_KEY, scheduleKey: SCHEDULE_STORAGE_KEY }
    )
  })

  test('shows an MD3 workflow library, deterministic shortcuts, and schedule state', async ({
    page
  }) => {
    await page.setViewportSize({ width: 420, height: 860 })
    await page.goto('/?mode=sidebar')

    await page.getByTestId('agent-workflow-toggle').click()
    const panel = page.getByTestId('agent-workflow-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('搜索论坛更新')
    await expect(panel).toContainText('/search-forum')
    await expect(panel).toContainText('2 个动作')
    await expect(panel).toContainText('定时已开启')
    await expect(panel).toContainText('登录流程')
    await expect(panel).toContainText('敏感字段已脱敏，禁止自动回放')

    const redactedCard = page.getByTestId('agent-workflow-workflow-login')
    await expect(redactedCard.getByRole('button', { name: /运\s*行/ })).toBeDisabled()
  })

  test('offers slash-command search and requires explicit schedule consent', async ({ page }) => {
    await page.goto('/?mode=sidebar')

    const input = page.getByPlaceholder('描述任务，或输入 / 运行工作流...')
    await input.fill('/search')
    const palette = page.getByTestId('agent-shortcut-palette')
    await expect(palette).toBeVisible()
    await expect(palette).toContainText('/search-forum')

    await page.getByTestId('agent-workflow-toggle').click()
    const workflowCard = page.getByTestId('agent-workflow-workflow-search')
    await workflowCard.getByRole('button', { name: /定\s*时/ }).click()
    const modal = page.getByRole('dialog', { name: '定时运行工作流' })
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('重复频率')
    await expect(modal.getByTestId('agent-workflow-schedule-cadence')).toContainText('每天')
    await modal.getByTestId('agent-workflow-schedule-cadence').click()
    await page.getByText('每月', { exact: true }).last().click()
    await expect(modal.getByTestId('agent-workflow-schedule-cadence')).toContainText('每月')
    await expect(modal.getByTestId('agent-workflow-first-run')).toHaveValue(/\d{4}-\d{2}-\d{2}T/)
    await expect(modal).toContainText('授权站点范围')
    await expect(modal).toContainText('https://forum.example.com')
    await expect(modal.getByRole('button', { name: '创建定时任务' })).toBeDisabled()
    await modal.getByRole('checkbox').check()
    await expect(modal.getByRole('button', { name: '创建定时任务' })).toBeEnabled()
  })

  test('records stable actions without ever serializing sensitive field values', async ({
    page
  }) => {
    await page.goto('/?mode=sidebar')
    await page.evaluate(() => {
      const captured: unknown[] = []
      Object.defineProperty(window, 'chrome', {
        configurable: true,
        value: {
          runtime: {
            getURL(path: string) {
              return new URL(`/${path}`, location.origin).toString()
            },
            async sendMessage(message: unknown) {
              captured.push(message)
              if ((message as { type?: string })?.type === 'AGENT_RECORDING_CONTENT_READY') {
                return { success: true, data: { active: true } }
              }
              return { success: true, data: null }
            }
          }
        }
      })
      const password = document.createElement('input')
      password.id = 'recording-password'
      password.type = 'password'
      password.name = 'password'
      password.placeholder = 'Password'
      const search = document.createElement('input')
      search.id = 'recording-search'
      search.type = 'search'
      search.name = 'q'
      search.placeholder = 'Search'
      document.body.append(password, search)
      ;(window as typeof window & { __workflowCapture?: unknown[] }).__workflowCapture = captured
      const loader = document.createElement('script')
      loader.src = '/content-loader.js'
      document.head.appendChild(loader)
    })

    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __workflowCapture?: Array<{ type?: string }>
            }
          ).__workflowCapture?.some(message => message.type === 'AGENT_RECORDING_CONTENT_READY')
        )
      )
      .toBe(true)

    await page.locator('#recording-password').fill('super-secret-password')
    await page.locator('#recording-search').fill('public query')
    await page.waitForTimeout(450)
    const captured = await page.evaluate(() => {
      return (window as typeof window & { __workflowCapture?: unknown[] }).__workflowCapture || []
    })

    const serialized = JSON.stringify(captured)
    expect(serialized).not.toContain('super-secret-password')
    expect(serialized).toContain('redacted-input')
    expect(serialized).toContain('public query')
    expect(serialized).toContain('#recording-search')
  })

  test('completes the record, stop, name, and save UI flow', async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now()
      const session = {
        id: 'recording-ui',
        tabId: 17,
        startedAt: now,
        updatedAt: now,
        startUrl: 'https://forum.example.com/latest',
        startTitle: 'Forum latest',
        lastUrl: 'https://forum.example.com/latest',
        actions: [{ id: 'click-ui', type: 'click-dom', selector: '#notifications' }],
        redactedFields: []
      }
      Object.defineProperty(window, 'chrome', {
        configurable: true,
        value: {
          runtime: {
            async sendMessage(message: { type?: string }) {
              if (message.type === 'AGENT_RECORDING_STATUS') {
                return { success: true, data: null }
              }
              if (message.type === 'AGENT_RECORDING_START') {
                return { success: true, data: { ...session, actions: [] } }
              }
              if (message.type === 'AGENT_RECORDING_STOP') {
                return { success: true, data: session }
              }
              return { success: true, data: null }
            },
            getURL(path: string) {
              return new URL(`/${path}`, location.origin).toString()
            }
          },
          tabs: {
            async query() {
              return [{ id: 17, url: session.startUrl, title: session.startTitle }]
            },
            async get() {
              return {
                id: 17,
                url: session.startUrl,
                title: session.startTitle,
                status: 'complete',
                active: true,
                windowId: 1
              }
            }
          }
        }
      })
    })
    await page.goto('/?mode=sidebar')

    await page.getByTestId('agent-record-start').click()
    await expect(page.getByTestId('agent-recording-banner')).toBeVisible()
    await page.getByTestId('agent-record-stop').click()

    const dialog = page.getByRole('dialog', { name: '保存浏览器工作流' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('已录制 1 个动作')
    await dialog.getByPlaceholder('例如：每日检查论坛通知').fill('检查论坛通知')
    await dialog.getByRole('button', { name: /保\s*存/ }).click()

    await expect(page.getByTestId('agent-workflow-panel')).toContainText('检查论坛通知')
  })
})
