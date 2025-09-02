// editor.ts - 负责把选中的表情插入到编辑器
import { logger } from './buildFlags'
import { cachedState } from './state'

export function insertEmojiIntoEditor(emoji: unknown) {
  // avoid noisy console in lint; keep only minimal info in debug environments
  // allow a local any here to bridge removed UI types; intentionally narrow in scope

  const em = emoji as any
  void em

  // Add emoji to favorites automatically
  try {
    chrome.runtime.sendMessage({
      action: 'addToFavorites',
      emoji: emoji
    })
  } catch (_e) {
    // Some environments may not support promise-based sendMessage
    try {
      ;(chrome as any).runtime.sendMessage({ action: 'addToFavorites', emoji })
    } catch (_ignored) {
      void _ignored
    }
    void _e
  }

  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textArea && !richEle) {
    logger.warn('找不到输入框')
    return
  }

  const match = em.url?.match(/_(\d{3,})x(\d{3,})\./)
  let width = '500'
  let height = '500'
  if (match) {
    width = match[1]
    height = match[2]
  } else if (em.width && em.height) {
    width = em.width.toString()
    height = em.height.toString()
  }

  const scale = (cachedState && cachedState.settings && cachedState.settings.imageScale) || 30
  const outputFormat =
    (cachedState && cachedState.settings && cachedState.settings.outputFormat) || 'markdown'

  if (textArea) {
    let emojiText = ''

    if (outputFormat === 'html') {
      // HTML格式输出
      const pixelWidth = Math.max(1, Math.round(Number(width) * (scale / 100)))
      const pixelHeight = Math.max(1, Math.round(Number(height) * (scale / 100)))
      emojiText = `<img src="${em.url}" title=":${em.name}:" class="emoji only-emoji" alt=":${em.name}:" loading="lazy" width="${pixelWidth}" height="${pixelHeight}" style="aspect-ratio: ${pixelWidth} / ${pixelHeight};"> `
    } else {
      // 默认Markdown格式输出
      emojiText = `![${em.name}|${width}x${height},${scale}%](${em.url}) `
    }

    const startPos = textArea.selectionStart
    const endPos = textArea.selectionEnd
    textArea.value =
      textArea.value.substring(0, startPos) +
      emojiText +
      textArea.value.substring(endPos, textArea.value.length)

    textArea.selectionStart = textArea.selectionEnd = startPos + emojiText.length
    textArea.focus()

    const event = new Event('input', { bubbles: true, cancelable: true })
    textArea.dispatchEvent(event)
  } else if (richEle) {
    const numericWidth = Number(width) || 500
    const pixelWidth = Math.max(1, Math.round(numericWidth * (scale / 100)))
    const imgTemplate = `<img src="${em.url}" alt="${em.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${pixelWidth}px">`

    try {
      const dt = new DataTransfer()
      dt.setData('text/html', imgTemplate)
      const evt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true
      })
      richEle.dispatchEvent(evt)
    } catch (_e) {
      try {
        document.execCommand('insertHTML', false, imgTemplate)
      } catch (e) {
        logger.warn('无法向富文本编辑器中插入表情', e)
      }
      void _e
    }
  }
}
