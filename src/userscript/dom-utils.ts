// DOM manipulation utilities for userscript
import { logger } from '@/config/buildFlags'
import type { UserscriptStorage } from './userscript-storage'

// Check if current page should have emoji injection (copied from content script)
export function shouldInjectEmoji(): boolean {
  // Check for discourse meta tags
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    logger.log('[Emoji Extension Userscript] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      logger.log('[Emoji Extension Userscript] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org', 'pixiv.net']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    logger.log('[Emoji Extension Userscript] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    logger.log('[Emoji Extension Userscript] Discussion editor detected')
    return true
  }

  logger.log('[Emoji Extension Userscript] No compatible platform detected')
  return false
}

// Insert emoji into editor (adapted from content script)
export function insertEmojiIntoEditor(emoji: any, userscriptState: UserscriptStorage) {
  logger.log('[Emoji Extension Userscript] Inserting emoji:', emoji)

  const textarea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const proseMirror = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textarea && !proseMirror) {
    logger.error('找不到输入框')
    return
  }

  // Extract dimensions from URL or use defaults
  const dimensionMatch = emoji.url?.match(/_(\d{3,})x(\d{3,})\./)
  let width = '500'
  let height = '500'

  if (dimensionMatch) {
    width = dimensionMatch[1]
    height = dimensionMatch[2]
  } else if (emoji.width && emoji.height) {
    width = emoji.width.toString()
    height = emoji.height.toString()
  }

  const scale = userscriptState.settings?.imageScale || 30
  const outputFormat = userscriptState.settings?.outputFormat || 'markdown'

  if (textarea) {
    let insertText = ''

    if (outputFormat === 'html') {
      const scaledWidth = Math.max(1, Math.round(Number(width) * (scale / 100)))
      const scaledHeight = Math.max(1, Math.round(Number(height) * (scale / 100)))
      insertText = `<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};"> `
    } else {
      insertText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    textarea.value =
      textarea.value.substring(0, selectionStart) +
      insertText +
      textarea.value.substring(selectionEnd, textarea.value.length)
    textarea.selectionStart = textarea.selectionEnd = selectionStart + insertText.length
    textarea.focus()

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true, cancelable: true })
    textarea.dispatchEvent(inputEvent)
  } else if (proseMirror) {
    const imgWidth = Number(width) || 500
    const scaledWidth = Math.max(1, Math.round(imgWidth * (scale / 100)))
    const htmlContent = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${scaledWidth}px">`

    try {
      // Try clipboard approach first
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/html', htmlContent)
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true })
      proseMirror.dispatchEvent(pasteEvent)
    } catch (error) {
      try {
        // Fallback to execCommand
        document.execCommand('insertHTML', false, htmlContent)
      } catch (fallbackError) {
        logger.error('无法向富文本编辑器中插入表情', fallbackError)
      }
    }
  }
}

// Find toolbars where we can inject buttons (copied from injector.ts)
const toolbarSelectors = ['.d-editor-button-bar[role="toolbar"]', '.chat-composer__inner-container']

export function findAllToolbars(): HTMLElement[] {
  const toolbars: HTMLElement[] = []
  for (const selector of toolbarSelectors) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...(Array.from(elements) as HTMLElement[]))
  }
  return toolbars
}
