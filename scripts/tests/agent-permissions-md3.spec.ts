import { expect, test } from '@playwright/test'

test.describe('PI agent permission controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-active-panel', 'agent')
    })
  })

  test('defaults to auto mode and exposes the MD3 site permission manager', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 820 })
    await page.goto('/?mode=sidebar')

    await expect(page.getByText('Pi Task Agent')).toBeVisible()
    await expect(page.getByTestId('agent-approval-mode')).toContainText('自动批准')
    await expect(page.getByText('已授权站点自动执行，其他站点先询问')).toBeVisible()

    await page.getByTestId('agent-site-permissions-toggle').click()
    const panel = page.getByTestId('agent-site-permissions-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('暂无持久站点权限')
  })

  test('migrates the legacy switch and persists an explicit three-mode selection', async ({
    page
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('agent-permission-seeded')) {
        localStorage.setItem('ai-agent-bypass-mode-v1', 'false')
        localStorage.removeItem('ai-agent-approval-mode-v1')
        sessionStorage.setItem('agent-permission-seeded', 'true')
      }
    })
    await page.goto('/?mode=sidebar')

    const select = page.getByTestId('agent-approval-mode')
    await expect(select).toContainText('手动批准')
    await select.click()
    await page.getByText('跳过批准', { exact: true }).last().click()
    await expect(select).toContainText('跳过批准')
    await expect(page.getByText('受保护动作仍会确认，禁止动作始终拦截')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('agent-approval-mode')).toContainText('跳过批准')
    expect(await page.evaluate(() => localStorage.getItem('ai-agent-bypass-mode-v1'))).toBeNull()
  })

  test('pauses a protected action even when skip mode is selected', async ({ page }) => {
    await page.addInitScript(() => {
      const action = {
        id: 'write-report',
        type: 'write-file',
        rootAlias: 'workspace',
        path: 'report.md',
        content: '# report'
      }
      localStorage.setItem('ai-agent-approval-mode-v1', 'skip')
      localStorage.setItem(
        'ai-agent-messages-v1',
        JSON.stringify([{ id: 'assistant-approval', role: 'assistant', content: '准备写入报告。' }])
      )
      localStorage.setItem(
        'ai-agent-session-v1',
        JSON.stringify({
          pendingActions: [action],
          pendingActionsAssistantId: 'assistant-approval',
          lastToolUseIds: ['tool-write'],
          lastToolInputs: [{ actions: [action], message: '写入报告' }],
          lastParallelActions: false,
          lastUserInput: '写一份报告'
        })
      )
    })
    await page.goto('/?mode=sidebar')

    const card = page.getByTestId('agent-approval-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-status', 'approval-required')
    await expect(card).toContainText('写入本地文件')
    await expect(card.getByRole('button', { name: /拒\s*绝/ })).toBeVisible()
    await expect(card.getByRole('button', { name: '仅本次允许' })).toBeVisible()
  })

  test('hard-blocks prohibited actions without exposing an approval bypass', async ({ page }) => {
    await page.addInitScript(() => {
      const action = {
        id: 'place-order',
        type: 'click-dom',
        selector: '#place-order',
        note: '确认订单并支付'
      }
      localStorage.setItem('ai-agent-approval-mode-v1', 'skip')
      localStorage.setItem(
        'ai-agent-messages-v1',
        JSON.stringify([{ id: 'assistant-blocked', role: 'assistant', content: '准备提交订单。' }])
      )
      localStorage.setItem(
        'ai-agent-session-v1',
        JSON.stringify({
          pendingActions: [action],
          pendingActionsAssistantId: 'assistant-blocked',
          lastToolUseIds: ['tool-purchase'],
          lastToolInputs: [{ actions: [action], message: '提交订单' }],
          lastParallelActions: false,
          lastUserInput: '帮我购买这个商品'
        })
      )
    })
    await page.goto('/?mode=sidebar')

    const card = page.getByTestId('agent-approval-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-status', 'blocked')
    await expect(card).toContainText('动作已安全阻止')
    await expect(card).toContainText('禁止完成购买或支付交易')
    await expect(card.getByRole('button', { name: '停止这批动作' })).toBeVisible()
    await expect(card.getByRole('button', { name: '仅本次允许' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: /始终允许/ })).toHaveCount(0)
  })

  test('manages saved site decisions from the AI agent settings page', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ai-agent-approval-mode-v1', 'manual')
      localStorage.setItem(
        'ai-agent-site-permissions-v1',
        JSON.stringify([
          {
            key: 'https://linux.do',
            label: 'linux.do',
            url: 'https://linux.do',
            persistable: true,
            decision: 'allow',
            updatedAt: Date.now()
          }
        ])
      )
    })
    await page.goto('/?type=options&tabs=settings&subtab=ai-agent')

    const settings = page.getByTestId('agent-site-permission-settings')
    await expect(settings).toBeVisible()
    await expect(settings.getByTestId('managed-agent-approval-mode')).toContainText('手动批准')
    await expect(settings).toContainText('linux.do')
    await settings.getByRole('button', { name: /改为阻止/ }).click()
    await expect(settings).toContainText('https://linux.do · 已阻止')
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('ai-agent-site-permissions-v1')!)[0].decision
      )
    ).toBe('block')
  })
})
