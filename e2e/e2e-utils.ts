import { Page, Locator } from '@playwright/test'

export namespace Antd {
  export async function select(locator: Locator, value: string) {
    await locator.click()
    await locator
      .page()
      .locator('.ant-select-item-option-content')
      .getByText(value, { exact: true })
      .click()
  }
}

export namespace VTab {
  export async function goTo(page: Page, tabName: string) {
    await page.locator('.ant-tabs-tab-btn').getByText(tabName, { exact: true }).click()
  }
}

export namespace VDialog {
  export async function confirm(page: Page, title: string) {
    const dialog = page.locator('.ant-modal-confirm-title').getByText(title, { exact: true })
    await dialog.waitFor({ state: 'visible' })
    await dialog.locator('..').getByRole('button', { name: 'OK' }).click()
  }
}
