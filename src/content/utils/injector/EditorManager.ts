/**
 * EditorManager - 管理编辑器操作
 * 负责文本插入、光标处理等
 */

import { DQS } from '../createEl'

export class EditorManager {
  /**
   * 查找编辑器元素
   */
  findEditor(): HTMLTextAreaElement | null {
    // 尝试多种选择器查找编辑器
    const selectors = [
      'textarea.d-editor-input',
      'textarea[name="reply"]',
      '.chat-composer-input textarea',
      'textarea.ember-text-area'
    ]

    for (const selector of selectors) {
      const editor = DQS(selector) as HTMLTextAreaElement | null
      if (editor) return editor
    }

    return null
  }

  /**
   * 在编辑器中插入文本
   */
  insertText(text: string, editor?: HTMLTextAreaElement) {
    const targetEditor = editor || this.findEditor()
    if (!targetEditor) {
      console.warn('[EditorManager] Editor not found')
      return false
    }

    const start = targetEditor.selectionStart || 0
    const end = targetEditor.selectionEnd || 0
    const before = targetEditor.value.substring(0, start)
    const after = targetEditor.value.substring(end)

    targetEditor.value = before + text + after
    targetEditor.selectionStart = targetEditor.selectionEnd = start + text.length

    // 触发 input 事件以通知框架
    targetEditor.dispatchEvent(new Event('input', { bubbles: true }))
    targetEditor.focus()

    return true
  }

  /**
   * 获取当前光标位置
   */
  getCursorPosition(editor?: HTMLTextAreaElement): { start: number; end: number } | null {
    const targetEditor = editor || this.findEditor()
    if (!targetEditor) return null

    return {
      start: targetEditor.selectionStart || 0,
      end: targetEditor.selectionEnd || 0
    }
  }

  /**
   * 设置光标位置
   */
  setCursorPosition(start: number, end?: number, editor?: HTMLTextAreaElement) {
    const targetEditor = editor || this.findEditor()
    if (!targetEditor) return false

    targetEditor.selectionStart = start
    targetEditor.selectionEnd = end !== undefined ? end : start
    targetEditor.focus()

    return true
  }

  /**
   * 获取选中的文本
   */
  getSelectedText(editor?: HTMLTextAreaElement): string | null {
    const targetEditor = editor || this.findEditor()
    if (!targetEditor) return null

    const start = targetEditor.selectionStart || 0
    const end = targetEditor.selectionEnd || 0
    return targetEditor.value.substring(start, end)
  }

  /**
   * 替换选中的文本
   */
  replaceSelection(text: string, editor?: HTMLTextAreaElement) {
    return this.insertText(text, editor)
  }
}

// 导出单例
export const editorManager = new EditorManager()
