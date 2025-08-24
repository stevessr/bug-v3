// editor.ts - 负责把选中的表情插入到编辑器
declare const chrome: any
import { cachedState } from './state'

export function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension] Inserting emoji:', emoji)

  // Add emoji to favorites automatically
  try {
    chrome.runtime.sendMessage({
      action: 'addToFavorites',
      emoji: emoji
    })
  } catch (e) {
    // Some environments may not support promise-based sendMessage
    try {
      chrome.runtime.sendMessage({ action: 'addToFavorites', emoji })
    } catch (_) {}
  }

  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textArea && !richEle) {
    console.error('找不到输入框')
    return
  }

  const match = emoji.url?.match(/_(\d{3,})x(\d{3,})\./)
  let width = '500'
  let height = '500'
  if (match) {
    width = match[1]
    height = match[2]
  } else if (emoji.width && emoji.height) {
    width = emoji.width.toString()
    height = emoji.height.toString()
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
      emojiText = `<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${pixelWidth}" height="${pixelHeight}" style="aspect-ratio: ${pixelWidth} / ${pixelHeight};"> `
    } else {
      // 默认Markdown格式输出
      emojiText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `
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
    const imgTemplate = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${pixelWidth}px">`

    try {
      const dt = new DataTransfer()
      dt.setData('text/html', imgTemplate)
      const evt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true
      })
      richEle.dispatchEvent(evt)
    } catch (_) {
      try {
        document.execCommand('insertHTML', false, imgTemplate)
      } catch (e) {
        console.error('无法向富文本编辑器中插入表情', e)
      }
    }
  }
}
