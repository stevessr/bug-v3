// editor.ts - 负责把选中的表情插入到编辑器

import { cachedState } from '../../data/state'
import { DQS } from '../../utils/dom/createEl'

import { uploadThroughDiscourseRoute } from './nativeUpload'

import { buildMarkdownImage, shouldUseShortUrl } from '@/utils/emojiMarkdown'
import type { Emoji } from '@/types/type'
import { fetchTenorMediaAsBlob } from '@/utils/tenor'

export type PickerContext = 'chat' | 'composer'

function getSafeEmojiSource(emoji: { url?: string; short_url?: string | null }) {
  const hostname = window.location.hostname
  return {
    url: emoji.url,
    short_url: shouldUseShortUrl(emoji, hostname) ? emoji.short_url : null
  }
}

/**
 * 判断当前是否处于 Discourse 聊天编辑器（chat composer）中。
 */
function isChatComposerActive(): boolean {
  return Boolean(
    DQS('.chat-composer:not([hidden])') ||
    DQS('.chat-composer__inner-container:not([hidden])') ||
    DQS('#channel-composer') ||
    DQS('.chat-composer__input') ||
    DQS('textarea.chat-composer__input')
  )
}

function getEmojiFileExtension(url: string, contentType: string): string {
  const match = url.match(/\.(png|jpe?g|gif|webp|avif|svg|apng|bmp)(?:$|[?#])/i)
  if (match) return match[1].toLowerCase()
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('svg')) return 'svg'
  return 'png'
}

/**
 * 聊天编辑器：把表情图片交给 Discourse 原生聊天上传机制
 * （#channel-file-uploader -> Uppy chat-composer 上传，显示原生预览），
 * 而不是往文本框里插入 markdown/HTML。
 */
async function insertEmojiIntoChat(emoji: Emoji): Promise<boolean> {
  try {
    const sourceUrl = emoji.url || emoji.displayUrl
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return false

    const { blob, contentType } = await fetchTenorMediaAsBlob(sourceUrl)
    if (!blob || blob.size === 0) return false

    const safeName =
      (emoji.name || 'emoji').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 64) || 'emoji'
    const filename = `${safeName}.${getEmojiFileExtension(sourceUrl, contentType)}`
    const file = new File([blob], filename, { type: contentType })

    const attempt = await uploadThroughDiscourseRoute(file, 'chat')
    return attempt.status === 'delegated' || attempt.status === 'uploaded'
  } catch (e) {
    console.warn('[Emoji] 聊天原生图片上传失败，回退为文本插入', e)
    return false
  }
}

export async function insertEmojiIntoEditor(emoji: Emoji, context?: PickerContext) {
  const em = emoji

  // Add emoji to favorites automatically
  try {
    chrome.runtime.sendMessage({
      type: 'ADD_TO_FAVORITES',
      payload: {
        emoji: emoji
      }
    })
  } catch (_e) {
    // Some environments may not support promise-based sendMessage
    try {
      ;(chrome as any).runtime.sendMessage({
        type: 'ADD_TO_FAVORITES',
        payload: {
          emoji
        }
      })
    } catch (_ignored) {
      void _ignored
    }
    void _e
  }

  // If emoji has customOutput configured, use it directly
  if (em.customOutput && em.customOutput.trim()) {
    const customText = em.customOutput

    // Try several selectors as fallback targets
    const selectors = [
      'textarea.d-editor-input',
      'textarea.ember-text-area',
      '#channel-composer',
      '.chat-composer__input',
      'textarea.chat-composer__input'
    ]

    const richEle = DQS('.ProseMirror.d-editor-input') as HTMLElement | null
    let textArea: HTMLTextAreaElement | null = null
    for (const s of selectors) {
      const el = DQS(s) as HTMLTextAreaElement | null
      if (el) {
        textArea = el
        break
      }
    }

    const contentEditable = DQS('[contenteditable="true"]') as HTMLElement | null

    if (!textArea && !richEle && !contentEditable) {
      console.warn('找不到输入框')
      return
    }

    // Insert custom output text
    if (textArea) {
      const startPos = textArea.selectionStart
      const endPos = textArea.selectionEnd
      textArea.value =
        textArea.value.substring(0, startPos) +
        customText +
        textArea.value.substring(endPos, textArea.value.length)

      textArea.selectionStart = textArea.selectionEnd = startPos + customText.length
      textArea.focus()
    } else if (richEle) {
      // For rich text editor, insert as text node
      const textNode = document.createTextNode(customText)
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      richEle.focus()
    } else if (contentEditable) {
      const textNode = document.createTextNode(customText)
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      contentEditable.focus()
    }

    return
  }

  // 聊天编辑器：优先走 Discourse 原生聊天图片上传机制
  const resolvedContext = context ?? (isChatComposerActive() ? 'chat' : 'composer')
  if (resolvedContext === 'chat' && em.url) {
    const uploaded = await insertEmojiIntoChat(em)
    if (uploaded) return
    // 原生上传不可用时，回退为下面的文本插入
  }

  // Default behavior: use markdown/html format based on settings
  // Try several selectors as fallback targets. Some pages (eg. chat) use
  // different textarea ids/classes such as #channel-composer or
  // .chat-composer__input. Also prefer any ember-text-area instances.
  const selectors = [
    'textarea.d-editor-input',
    'textarea.ember-text-area',
    '#channel-composer',
    '.chat-composer__input',
    'textarea.chat-composer__input'
  ]

  // Prefer the rich ProseMirror editor when present
  const richEle = DQS('.ProseMirror.d-editor-input') as HTMLElement | null

  // Find the first matching textarea from the selectors list
  let textArea: HTMLTextAreaElement | null = null
  for (const s of selectors) {
    const el = DQS(s) as HTMLTextAreaElement | null
    if (el) {
      textArea = el
      break
    }
  }

  // As an extra fallback, try any contenteditable element often used as an
  // input (for chat/composer implementations). We'll treat it similar to a
  // rich editor and insert HTML or plain text accordingly.
  const contentEditable = DQS('[contenteditable="true"]') as HTMLElement | null

  if (!textArea && !richEle && !contentEditable) {
    console.warn('找不到输入框')
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

    if (em.customOutput) {
      emojiText = em.customOutput
    } else if (outputFormat === 'html') {
      // HTML 格式输出
      const pixelWidth = Math.max(1, Math.round(Number(width) * (scale / 100)))
      const pixelHeight = Math.max(1, Math.round(Number(height) * (scale / 100)))
      emojiText = `<img src="${em.url}" title=":${em.name}:" class="emoji only-emoji" alt=":${em.name}:" loading="lazy" width="${pixelWidth}" height="${pixelHeight}" style="aspect-ratio: ${pixelWidth} / ${pixelHeight};"> `
    } else {
      // 默认 Markdown 格式输出
      emojiText = `${buildMarkdownImage(`${em.name}|${width}x${height},${scale}%`, getSafeEmojiSource(em))} `
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
        console.warn('无法向富文本编辑器中插入表情', e)
      }
      void _e
    }
  } else if (contentEditable) {
    // Insert into a generic contenteditable. If the format is HTML, insert
    // an <img>; otherwise append a markdown-like text node.
    try {
      if (outputFormat === 'html') {
        const numericWidth = Number(width) || 500
        const pixelWidth = Math.max(1, Math.round(numericWidth * (scale / 100)))
        const imgTemplate = `<img src="${em.url}" alt="${em.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${pixelWidth}px"> `
        // Use the Selection/Range API to insert HTML
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          const frag = document.createRange().createContextualFragment(imgTemplate)
          range.deleteContents()
          range.insertNode(frag)
          // Move caret after inserted node
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          contentEditable.insertAdjacentHTML('beforeend', imgTemplate)
        }
      } else {
        const emojiText = `${buildMarkdownImage(`${em.name}|${width}x${height},${scale}%`, getSafeEmojiSource(em))} `
        // Append text node
        const textNode = document.createTextNode(emojiText)
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          range.deleteContents()
          range.insertNode(textNode)
          range.setStartAfter(textNode)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          contentEditable.appendChild(textNode)
        }
      }

      // Emit input events to mimic user interaction
      const inputEvt = new Event('input', { bubbles: true, cancelable: true })
      contentEditable.dispatchEvent(inputEvt)
    } catch (e) {
      console.warn('无法向 contenteditable 插入表情', e)
    }
  }
}
