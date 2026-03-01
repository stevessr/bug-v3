/**
 * ToolbarHelper - 工具栏查找和管理
 * 负责查找不同平台的工具栏元素
 */

import { DQSA, DQS } from '../dom/createEl'

// 不同上下文的工具栏选择器
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar', // 标准编辑器工具栏
  '.chat-composer__inner-container' // 聊天编辑器
]

export class ToolbarHelper {
  /**
   * 查找第一个可用的工具栏
   */
  findToolbar(): Element | null {
    for (const selector of TOOLBAR_SELECTORS) {
      const toolbar = DQS(selector)
      if (toolbar) {
        return toolbar
      }
    }
    return null
  }

  /**
   * 查找所有工具栏
   */
  findAllToolbars(): Element[] {
    const toolbars: Element[] = []
    for (const selector of TOOLBAR_SELECTORS) {
      const elements = DQSA(selector)
      toolbars.push(...Array.from(elements))
    }
    return toolbars
  }

  /**
   * 检查工具栏是否存在
   */
  hasToolbar(): boolean {
    return this.findToolbar() !== null
  }

  /**
   * 等待工具栏出现
   */
  async waitForToolbar(timeout = 5000): Promise<Element | null> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const toolbar = this.findToolbar()
      if (toolbar) return toolbar

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return null
  }
}

// 导出单例
export const toolbarHelper = new ToolbarHelper()

// 导出兼容函数
export const findToolbar = () => toolbarHelper.findToolbar()
export const findAllToolbars = () => toolbarHelper.findAllToolbars()
