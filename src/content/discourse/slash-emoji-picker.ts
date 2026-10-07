import { cachedState } from '../data/state'

import {
  getEmojiPickerImageUrl,
  getEmojiPickerPreviewUrl,
  isMotionHeavyEmoji,
  preparePickerImage,
  createPickerImageObserver
} from './utils/pickerPerformance'

import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import type { Emoji, EmojiGroup } from '@/types/type'
import { buildMarkdownImage, shouldUseShortUrl } from '@/utils/emojiMarkdown'

type Editor = HTMLTextAreaElement | HTMLElement
const SELECTOR =
  'textarea.d-editor-input, textarea.chat-composer__input, textarea#channel-composer, .ProseMirror.d-editor-input[contenteditable="true"]'
const ID = 'emoji-extension-slash-picker'
const COLUMNS = 3

/** Delegated listeners survive Discourse SPA editor replacement. Returns a cleanup for tests/uninject. */
export function initSlashEmojiPicker(): () => void {
  if (document.getElementById(`${ID}-styles`)) return () => {}
  const styles = document.createElement('style')
  styles.id = `${ID}-styles`
  styles.textContent = `
#${ID}{position:fixed;z-index:2147483646;width:min(360px,calc(100vw - 16px));background:var(--secondary,#fff);color:var(--primary,#222);border:1px solid var(--primary-low,#ddd);border-radius:10px;box-shadow:0 8px 30px #0004;padding:8px;font:14px/1.5 system-ui;box-sizing:border-box}
#${ID} .slash-items{max-height:220px;overflow:auto;display:grid;gap:4px}
#${ID} .slash-group{display:flex;align-items:center;gap:8px;overflow:hidden}
#${ID} .slash-group-icon{width:28px;height:28px;flex:0 0 28px}
#${ID} .slash-group-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ID} .slash-grid{grid-template-columns:repeat(${COLUMNS},minmax(0,1fr))}
#${ID} button{font:inherit;color:inherit;border:0;background:transparent;border-radius:6px;padding:8px;text-align:left;cursor:pointer;min-width:0}
#${ID} button[aria-selected=true],#${ID} button[aria-current=true]{background:var(--tertiary-low,#dbeafe);outline:2px solid var(--tertiary,#2563eb);outline-offset:-2px}
#${ID} .slash-grid button{display:flex;align-items:center;justify-content:center;min-height:52px;padding:4px}
#${ID} img,#${ID} canvas{object-fit:contain;max-width:100%;max-height:64px}
#${ID} .slash-header{display:flex;align-items:center;gap:6px;margin-bottom:6px}
#${ID} .slash-hint{font-size:11px;opacity:.7;margin-top:6px}
#${ID} .slash-preview{display:flex;align-items:center;gap:8px;height:64px;margin-top:6px;overflow:hidden}
#${ID} .slash-preview img{width:64px;height:64px}
@media(prefers-color-scheme:dark){#${ID}{background:var(--secondary,#202124);color:var(--primary,#eee);border-color:var(--primary-low,#555)}}`
  document.head.append(styles)
  let editor: Editor | null = null
  let start = 0
  let end = 0
  let textNode: Text | null = null
  let selectedGroup: EmojiGroup | null = null
  let groupEnd = 0
  let index = 0
  let items: (EmojiGroup | Emoji)[] = []
  let box: HTMLDivElement | null = null
  let observer: ReturnType<typeof createPickerImageObserver> | null = null
  let composing = false
  let inputAtOpen = ''
  let searchQuery = ''
  let previousControls: string | null = null
  let previousActive: string | null = null

  const enabled = () => cachedState.settings.enableSlashEmojiPicker === true
  const close = () => {
    observer?.disconnect()
    observer = null
    box?.remove()
    box = null
    if (editor) {
      if (previousControls === null) editor.removeAttribute('aria-controls')
      else editor.setAttribute('aria-controls', previousControls)
      if (previousActive === null) editor.removeAttribute('aria-activedescendant')
      else editor.setAttribute('aria-activedescendant', previousActive)
    }
    editor = null
    selectedGroup = null
    items = []
    textNode = null
  }
  const caret = (target: Editor) => {
    if (target instanceof HTMLTextAreaElement) {
      if (target.selectionStart !== target.selectionEnd) return null
      return {
        before: target.value.slice(0, target.selectionStart),
        pos: target.selectionStart,
        node: null
      }
    }
    const selection = window.getSelection()
    if (!selection?.isCollapsed || !selection.rangeCount) return null
    const range = selection.getRangeAt(0)
    if (range.startContainer.nodeType !== Node.TEXT_NODE || !target.contains(range.startContainer))
      return null
    return {
      before: (range.startContainer.textContent || '').slice(0, range.startOffset),
      pos: range.startOffset,
      node: range.startContainer as Text
    }
  }
  const position = () => {
    if (!box || !editor) return
    const rect = editor.getBoundingClientRect()
    const width = box.getBoundingClientRect().width
    const height = box.getBoundingClientRect().height
    box.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
    box.style.top = `${Math.max(8, rect.top >= height + 8 ? rect.top - height - 6 : Math.min(rect.bottom + 6, window.innerHeight - height - 8))}px`
  }
  const highlight = () => {
    if (!box || !editor) return
    const buttons = box.querySelectorAll<HTMLButtonElement>('[role=option]')
    buttons.forEach((button, i) => button.setAttribute('aria-selected', String(i === index)))
    const active = buttons[index]
    if (active) {
      editor.setAttribute('aria-activedescendant', active.id)
      active.scrollIntoView({ block: 'nearest' })
    } else editor.removeAttribute('aria-activedescendant')
    const preview = box.querySelector('.slash-preview')
    if (!preview) return
    preview.replaceChildren()
    if (selectedGroup && items[index]) {
      const emoji = items[index] as Emoji
      const image = document.createElement('img')
      image.src = getEmojiPickerPreviewUrl(emoji)
      image.alt = emoji.name
      const label = document.createElement('span')
      label.textContent = emoji.name
      preview.append(image, label)
    }
  }
  const choose = () => {
    if (!editor || !items[index] || !enabled()) return close()
    if (
      selectedGroup &&
      !cachedState.emojiGroups.some(
        (group: EmojiGroup) =>
          group.id === selectedGroup?.id &&
          group.emojis?.some(emoji => emoji.id === items[index].id)
      )
    )
      return close()
    if (!selectedGroup) {
      if (!cachedState.emojiGroups.some((group: EmojiGroup) => group.id === items[index].id))
        return close()
      selectedGroup = items[index] as EmojiGroup
      groupEnd = end
      index = 0
      const query = selectedGroup.name.toLocaleLowerCase().includes(searchQuery.toLocaleLowerCase())
        ? ''
        : searchQuery
      render(query)
      return
    }
    // Revalidate the pinned caret/token: never insert in another editor or stale range.
    const current = caret(editor)
    if (
      !current ||
      current.pos !== end ||
      current.node !== textNode ||
      current.before.slice(start, end) !== inputAtOpen
    )
      return close()
    const emoji = items[index] as Emoji
    const scale = cachedState.settings.imageScale || 100
    const output = emoji.customOutput?.trim()
      ? emoji.customOutput
      : buildMarkdownImage(`${emoji.name}|${emoji.width || 500}x${emoji.height || 500},${scale}%`, {
          url: emoji.url,
          short_url: shouldUseShortUrl(emoji, window.location.hostname) ? emoji.short_url : null
        }) + ' '
    const target = editor
    const savedStart = start
    const savedEnd = end
    const node = textNode
    close()
    target.focus({ preventScroll: true })
    if (target instanceof HTMLTextAreaElement) {
      target.setSelectionRange(savedStart, savedEnd)
      // Native editing retains undo history. Fallback for environments without execCommand.
      if (!document.execCommand('insertText', false, output)) {
        target.setRangeText(output, savedStart, savedEnd, 'end')
        target.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertText', data: output })
        )
      }
    } else if (node?.isConnected) {
      const range = document.createRange()
      range.setStart(node, savedStart)
      range.setEnd(node, savedEnd)
      const selection = window.getSelection()
      if (!selection) return
      selection.removeAllRanges()
      selection.addRange(range)
      // Let ProseMirror handle paste through its own transaction/undo machinery.
      const data = new DataTransfer()
      data.setData('text/plain', output)
      const paste = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: data
      })
      target.dispatchEvent(paste)
      if (!paste.defaultPrevented) document.execCommand('insertText', false, output)
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        void chrome.runtime.sendMessage({ type: 'ADD_TO_FAVORITES', payload: { emoji } })
      }
    } catch {
      /* Some test/page contexts do not provide extension messaging. */
    }
  }
  const matchesEmoji = (emoji: Emoji, query: string) =>
    [emoji.name, ...(emoji.tags || [])].some(value =>
      value.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())
    )
  const createEmojiImage = (emoji: Emoji, eager: boolean) => {
    const image = document.createElement('img')
    const size = isMotionHeavyEmoji(emoji) ? 64 : 32
    image.alt = emoji.name
    image.onload = () => {
      // Freeze the first decoded frame in the grid; the selected preview stays animated.
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth > 0 ? Math.min(image.naturalWidth, 128) : size
      canvas.height = Math.max(
        1,
        Math.round((canvas.width * image.naturalHeight) / Math.max(1, image.naturalWidth))
      )
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      if (image.parentNode) image.replaceWith(canvas)
      image.removeAttribute('src')
    }
    preparePickerImage(image, getEmojiPickerImageUrl(emoji), {
      eager,
      width: size,
      height: size
    })
    observer?.observe(image)
    return image
  }
  const render = (query: string) => {
    if (!box || !editor) return
    observer?.disconnect()
    searchQuery = query
    box.replaceChildren()
    const header = document.createElement('div')
    header.className = 'slash-header'
    if (selectedGroup) {
      const back = document.createElement('button')
      back.textContent = '‹ 返回分组'
      back.onclick = () => {
        selectedGroup = null
        index = 0
        render((editor && caret(editor)?.before.slice(start + 1, end)) || '')
      }
      header.append(back)
    }
    const title = document.createElement('strong')
    title.textContent = selectedGroup?.name || '选择表情分组'
    header.append(title)
    const list = document.createElement('div')
    list.className = `slash-items${selectedGroup ? ' slash-grid' : ''}`
    list.setAttribute('role', 'listbox')
    list.id = `${ID}-list`
    list.setAttribute('aria-label', selectedGroup ? '选择表情' : '选择分组')
    const source = selectedGroup
      ? selectedGroup.emojis
      : cachedState.emojiGroups.filter((group: EmojiGroup) => group.emojis?.length)
    items = source.filter((item: Emoji | EmojiGroup) =>
      selectedGroup
        ? matchesEmoji(item as Emoji, query)
        : item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()) ||
          (item as EmojiGroup).emojis.some(emoji => matchesEmoji(emoji, query))
    )
    index = Math.min(index, Math.max(0, items.length - 1))
    observer = createPickerImageObserver(box)
    items.forEach((item, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.tabIndex = -1
      button.id = `${ID}-option-${i}`
      button.setAttribute('role', 'option')
      button.setAttribute('aria-label', item.name)
      button.title = item.name
      if (selectedGroup) {
        const emoji = item as Emoji
        button.append(createEmojiImage(emoji, i < 18))
      } else {
        button.className = 'slash-group'
        const icon = (item as EmojiGroup).icon || '📁'
        if (isImageUrl(icon)) {
          const image = document.createElement('img')
          image.className = 'slash-group-icon'
          image.alt = ''
          image.loading = 'lazy'
          image.src = normalizeImageUrl(icon)
          image.onerror = () => {
            const fallback = document.createElement('span')
            fallback.className = 'slash-group-icon'
            fallback.textContent = '📁'
            image.replaceWith(fallback)
          }
          button.append(image)
        } else {
          const symbol = document.createElement('span')
          symbol.className = 'slash-group-icon'
          symbol.textContent = icon
          button.append(symbol)
        }
        const label = document.createElement('span')
        label.className = 'slash-group-name'
        label.textContent = item.name
        button.append(label)
      }
      button.onmouseenter = () => {
        index = i
        highlight()
      }
      button.onclick = () => {
        index = i
        choose()
      }
      list.append(button)
    })
    if (!items.length) list.textContent = '没有匹配的表情或分组'
    const preview = document.createElement('div')
    preview.className = 'slash-preview'
    preview.hidden = !selectedGroup
    const hint = document.createElement('div')
    hint.className = 'slash-hint'
    hint.textContent =
      '输入分组/表情名或标签搜索 · → 进入分组 · Backspace 返回 · Enter 确认 · Esc 取消'
    box.append(header, list, preview, hint)
    highlight()
    position()
  }
  const onInput = (event: Event) => {
    if (composing || (event as InputEvent).isComposing) return
    const target = event.target instanceof Element ? event.target.closest<Editor>(SELECTOR) : null
    if (
      !enabled() ||
      !target ||
      (target instanceof HTMLTextAreaElement && (target.disabled || target.readOnly))
    )
      return close()
    const current = caret(target)
    if (!current) return close()
    if (!box) {
      // Only a newly typed standalone slash, never a pasted URL/path or arbitrary input.
      if (
        (event as InputEvent).inputType !== 'insertText' ||
        (event as InputEvent).data !== '/' ||
        !/(?:^|\s)\/$/.test(current.before)
      )
        return
      editor = target
      start = current.pos - 1
      textNode = current.node
      previousControls = target.getAttribute('aria-controls')
      previousActive = target.getAttribute('aria-activedescendant')
      box = document.createElement('div')
      box.id = ID
      box.onmousedown = e => e.preventDefault()
      document.body.append(box)
      target.setAttribute('aria-controls', `${ID}-list`)
      selectedGroup = null
      index = 0
    }
    if (
      editor !== target ||
      current.node !== textNode ||
      current.pos <= start ||
      current.before[start] !== '/'
    )
      return close()
    end = current.pos
    inputAtOpen = current.before.slice(start, end)
    if (inputAtOpen.includes('\n') || inputAtOpen.slice(1).includes('/')) return close()
    if (selectedGroup && end < groupEnd) {
      selectedGroup = null
      index = 0
    }
    if (!selectedGroup) {
      const query = current.before.slice(start + 1, end)
      const group = cachedState.emojiGroups
        .filter((group: EmojiGroup) => group.emojis?.length)
        .sort((a: EmojiGroup, b: EmojiGroup) => b.name.length - a.name.length)
        .find((group: EmojiGroup) =>
          query.toLocaleLowerCase().startsWith(group.name.toLocaleLowerCase() + ' ')
        )
      if (group) {
        selectedGroup = group
        groupEnd = start + 1 + group.name.length + 1
        index = 0
      }
    }
    render(current.before.slice(selectedGroup ? groupEnd : start + 1, end))
  }
  const onKey = (event: KeyboardEvent) => {
    if (!box || !editor) return
    if (!enabled() || !editor.isConnected || event.target !== editor) return close()
    if (composing || event.isComposing || event.keyCode === 229) return
    if (event.ctrlKey || event.metaKey || event.altKey) return close()
    const current = caret(editor)
    if (!current || current.pos !== end || current.node !== textNode) return close()
    let handled = true
    if (event.key === 'Escape') close()
    else if (event.key === 'Enter' || (!selectedGroup && event.key === 'ArrowRight')) choose()
    else if (event.key === 'ArrowDown') {
      index = Math.min(items.length - 1, index + (selectedGroup ? COLUMNS : 1))
      highlight()
    } else if (event.key === 'ArrowUp') {
      index = Math.max(0, index - (selectedGroup ? COLUMNS : 1))
      highlight()
    } else if (selectedGroup && event.key === 'ArrowRight') {
      index = Math.min(items.length - 1, index + 1)
      highlight()
    } else if (selectedGroup && event.key === 'ArrowLeft') {
      index = Math.max(0, index - 1)
      highlight()
    } else if (selectedGroup && event.key === 'Backspace' && end === groupEnd) {
      selectedGroup = null
      index = 0
      render(current.before.slice(start + 1, end))
    } else {
      handled = false
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab'].includes(event.key)) close()
    }
    if (handled) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  const outside = (event: Event) => {
    if (box && !box.contains(event.target as Node)) close()
  }
  const settingsChanged = () => {
    if (!enabled()) close()
  }
  const compositionStart = () => {
    composing = true
    close()
  }
  const compositionEnd = () => {
    composing = false
  }
  document.addEventListener('input', onInput, true)
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('compositionstart', compositionStart, true)
  document.addEventListener('compositionend', compositionEnd, true)
  window.addEventListener('emoji-extension-settings-changed', settingsChanged)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  return () => {
    close()
    styles.remove()
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('pointerdown', outside, true)
    document.removeEventListener('compositionstart', compositionStart, true)
    document.removeEventListener('compositionend', compositionEnd, true)
    window.removeEventListener('emoji-extension-settings-changed', settingsChanged)
    window.removeEventListener('resize', position)
    window.removeEventListener('scroll', position, true)
  }
}
