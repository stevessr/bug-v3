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

/** Delegated listeners survive Discourse SPA editor replacement. Returns a cleanup for tests/uninject. */
export function initSlashEmojiPicker(): () => void {
  if (document.getElementById(`${ID}-styles`)) return () => {}
  const styles = document.createElement('style')
  styles.id = `${ID}-styles`
  styles.textContent = `
#${ID}{position:fixed;z-index:2147483646;width:min(820px,calc(100vw - 16px));background:var(--secondary,#fff);color:var(--primary,#222);border:1px solid var(--primary-low,#ddd);border-radius:10px;box-shadow:0 8px 30px #0004;padding:10px;font:14px/1.5 system-ui;box-sizing:border-box}
#${ID} .slash-content{display:grid;grid-template-columns:minmax(150px,.62fr) minmax(0,1.38fr);gap:10px;min-width:0}
#${ID} .slash-items{max-height:280px;overflow:auto;display:grid;align-content:start;gap:4px;min-width:0}
#${ID} .slash-grid{grid-template-columns:repeat(var(--slash-columns,4),minmax(0,1fr));gap:6px}
#${ID} .slash-group{display:flex;align-items:center;gap:8px;overflow:hidden}
#${ID} .slash-group-icon{width:28px;height:28px;flex:0 0 28px}
#${ID} .slash-group-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ID} button{font:inherit;color:inherit;border:0;background:transparent;border-radius:6px;padding:8px;text-align:left;cursor:pointer;min-width:0}
#${ID} button[aria-selected=true],#${ID} button[aria-current=true]{background:var(--tertiary-low,#dbeafe);outline:2px solid var(--tertiary,#2563eb);outline-offset:-2px}
#${ID} .slash-grid button{display:flex;align-items:center;justify-content:center;min-height:68px;padding:5px}
#${ID} img,#${ID} canvas{object-fit:contain;max-width:100%;max-height:56px}
#${ID} .slash-header{display:flex;align-items:center;gap:6px;margin-bottom:6px}
#${ID} .slash-hint{font-size:11px;opacity:.7;margin-top:6px}
#${ID} .slash-preview{display:flex;align-items:center;gap:8px;height:64px;margin-top:6px;overflow:hidden}
#${ID} .slash-preview img{width:64px;height:64px}
@media(max-width:520px){#${ID} .slash-content{grid-template-columns:minmax(110px,.6fr) minmax(0,1.4fr);gap:6px}#${ID} .slash-group{gap:4px;padding:6px}}
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
  let groupItems: EmojiGroup[] = []
  let emojiItems: Emoji[] = []
  let activePane: 'groups' | 'emojis' = 'groups'
  let box: HTMLDivElement | null = null
  let observer: ReturnType<typeof createPickerImageObserver> | null = null
  let composing = false
  let inputAtOpen = ''
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
    groupItems = []
    emojiItems = []
    activePane = 'groups'
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
    const pane = box.querySelector(`[data-pane="${activePane}"]`)
    const buttons = pane?.querySelectorAll<HTMLButtonElement>('[role=option]') ?? []
    buttons.forEach((button, i) => button.setAttribute('aria-selected', String(i === index)))
    box.querySelectorAll<HTMLButtonElement>('[data-group-id]').forEach(button => {
      button.setAttribute('aria-current', String(button.dataset.groupId === selectedGroup?.id))
    })
    const active = buttons[index]
    if (active) {
      editor.setAttribute('aria-activedescendant', active.id)
      active.scrollIntoView({ block: 'nearest' })
    } else editor.removeAttribute('aria-activedescendant')
    const preview = box.querySelector('.slash-preview')
    if (!preview) return
    preview.replaceChildren()
    if (activePane === 'emojis' && selectedGroup && emojiItems[index]) {
      const emoji = emojiItems[index]
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
    if (activePane === 'groups') {
      const group = items[index] as EmojiGroup
      const query = caret(editor)?.before.slice(start + 1, end) || ''
      openGroup(group, query)
      return
    }
    if (
      selectedGroup &&
      !cachedState.emojiGroups.some(
        (group: EmojiGroup) =>
          group.id === selectedGroup?.id &&
          group.emojis?.some(emoji => emoji.id === emojiItems[index]?.id)
      )
    )
      return close()
    if (!selectedGroup) return close()
    // Revalidate the pinned caret/token: never insert in another editor or stale range.
    const current = caret(editor)
    if (
      !current ||
      current.pos !== end ||
      current.node !== textNode ||
      current.before.slice(start, end) !== inputAtOpen
    )
      return close()
    const emoji = emojiItems[index]
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
  const openGroup = (group: EmojiGroup, query: string) => {
    selectedGroup = group
    groupEnd = start + 1
    activePane = 'emojis'
    index = 0
    const normalized = query.toLocaleLowerCase().trim()
    render(normalized && group.name.toLocaleLowerCase().includes(normalized) ? '' : query)
  }
  const createEmojiImage = (emoji: Emoji, eager: boolean) => {
    const image = document.createElement('img')
    const size = isMotionHeavyEmoji(emoji) ? 64 : 48
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
    box.replaceChildren()
    const columns = Math.max(1, Math.min(12, Math.floor(cachedState.settings.gridColumns || 4)))
    box.style.setProperty('--slash-columns', String(columns))
    const header = document.createElement('div')
    header.className = 'slash-header'
    const title = document.createElement('strong')
    title.textContent = '选择表情'
    header.append(title)
    const content = document.createElement('div')
    content.className = 'slash-content'
    const groupsList = document.createElement('div')
    groupsList.className = 'slash-items slash-groups'
    groupsList.dataset.pane = 'groups'
    groupsList.setAttribute('role', 'listbox')
    groupsList.id = `${ID}-groups`
    groupsList.setAttribute('aria-label', '候选分组')
    const emojisList = document.createElement('div')
    emojisList.className = 'slash-items slash-grid slash-emojis'
    emojisList.dataset.pane = 'emojis'
    emojisList.setAttribute('role', 'listbox')
    emojisList.id = `${ID}-emojis`
    emojisList.setAttribute('aria-label', selectedGroup ? `${selectedGroup.name} 表情` : '分组表情')
    const normalizedQuery = query.toLocaleLowerCase().trim()
    groupItems = cachedState.emojiGroups.filter((group: EmojiGroup) => {
      if (!group.emojis?.length) return false
      // Once a submenu is active, keep all groups visible so the user can switch groups.
      if (selectedGroup) return true
      return (
        group.name.toLocaleLowerCase().includes(normalizedQuery) ||
        group.emojis.some(emoji => matchesEmoji(emoji, query))
      )
    })
    if (selectedGroup && !groupItems.some(group => group.id === selectedGroup?.id)) {
      selectedGroup = null
      activePane = 'groups'
    }
    if (!selectedGroup && groupItems.length) selectedGroup = groupItems[0]
    const normalizedGroupName = selectedGroup?.name.toLocaleLowerCase() || ''
    const emojiQuery =
      selectedGroup && normalizedQuery.startsWith(`${normalizedGroupName} `)
        ? query.trim().slice(selectedGroup.name.length).trim()
        : selectedGroup && normalizedQuery === normalizedGroupName
          ? ''
          : selectedGroup &&
              normalizedQuery &&
              !selectedGroup.name.toLocaleLowerCase().includes(normalizedQuery)
            ? query
            : ''
    emojiItems = selectedGroup
      ? selectedGroup.emojis.filter(emoji => !emojiQuery || matchesEmoji(emoji, emojiQuery))
      : []
    items = activePane === 'groups' ? groupItems : emojiItems
    index = Math.min(index, Math.max(0, items.length - 1))
    observer = createPickerImageObserver(box)
    groupItems.forEach((item, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.tabIndex = -1
      button.id = `${ID}-group-${i}`
      button.setAttribute('role', 'option')
      button.setAttribute('aria-label', item.name)
      button.title = item.name
      button.className = 'slash-group'
      button.dataset.groupId = item.id
      const icon = item.icon || '📁'
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
      button.onmouseenter = () => {
        activePane = 'groups'
        index = i
        if (selectedGroup?.id !== item.id) {
          selectedGroup = item
          groupEnd = end
          render('')
        } else highlight()
      }
      button.onclick = () => {
        const query = editor ? caret(editor)?.before.slice(start + 1, end) || '' : ''
        openGroup(item, query)
      }
      groupsList.append(button)
    })
    emojiItems.forEach((item, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.tabIndex = -1
      button.id = `${ID}-option-${i}`
      button.setAttribute('role', 'option')
      button.setAttribute('aria-label', item.name)
      button.title = item.name
      button.append(createEmojiImage(item, i < columns * 2))
      button.onmouseenter = () => {
        activePane = 'emojis'
        index = i
        items = emojiItems
        highlight()
      }
      button.onclick = () => {
        activePane = 'emojis'
        index = i
        items = emojiItems
        choose()
      }
      emojisList.append(button)
    })
    if (!groupItems.length) groupsList.textContent = '没有匹配分组'
    if (!emojiItems.length)
      emojisList.textContent = selectedGroup ? '分组内没有匹配表情' : '选择一个分组'
    content.append(groupsList, emojisList)
    box.setAttribute('aria-controls', `${ID}-groups ${ID}-emojis`)
    const preview = document.createElement('div')
    preview.className = 'slash-preview'
    preview.hidden = activePane !== 'emojis'
    const hint = document.createElement('div')
    hint.className = 'slash-hint'
    hint.textContent = '悬停/选择分组查看子菜单 · ↑↓ 切换 · → 展开 · ← 返回 · Enter 插入 · Esc 取消'
    box.append(header, content, preview, hint)
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
      target.setAttribute('aria-controls', `${ID}-groups ${ID}-emojis`)
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
    if (activePane === 'emojis' && end <= groupEnd) {
      selectedGroup = null
      activePane = 'groups'
      index = 0
    }
    const fullQuery = current.before.slice(start + 1, end)
    if (activePane === 'groups') {
      selectedGroup = null
      const group = cachedState.emojiGroups
        .filter((group: EmojiGroup) => group.emojis?.length)
        .sort((a: EmojiGroup, b: EmojiGroup) => b.name.length - a.name.length)
        .find((group: EmojiGroup) =>
          fullQuery.toLocaleLowerCase().startsWith(group.name.toLocaleLowerCase() + ' ')
        )
      if (group) {
        selectedGroup = group
        groupEnd = start + 1 + group.name.length + 1
        activePane = 'emojis'
        index = 0
        render(current.before.slice(groupEnd, end))
        return
      }
      render(fullQuery)
      return
    }
    render(current.before.slice(groupEnd, end))
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
    else if (event.key === 'Enter') choose()
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const columns = Math.max(1, Math.min(12, Math.floor(cachedState.settings.gridColumns || 4)))
      const step = activePane === 'emojis' ? direction * columns : direction
      index = Math.max(0, Math.min(items.length - 1, index + step))
      if (activePane === 'groups') {
        selectedGroup = groupItems[index] || null
        groupEnd = end
        render('')
      } else highlight()
    } else if (activePane === 'groups' && event.key === 'ArrowRight') {
      const group = groupItems[index] || selectedGroup
      if (group) openGroup(group, current.before.slice(start + 1, end))
    } else if (activePane === 'emojis' && event.key === 'ArrowRight') {
      index = Math.min(items.length - 1, index + 1)
      highlight()
    } else if (activePane === 'emojis' && event.key === 'ArrowLeft') {
      const columns = Math.max(1, Math.min(12, Math.floor(cachedState.settings.gridColumns || 4)))
      if (index % columns === 0) {
        activePane = 'groups'
        selectedGroup = null
        index = 0
        render(current.before.slice(start + 1, end))
      } else {
        index = Math.max(0, index - 1)
        highlight()
      }
    } else if (activePane === 'emojis' && event.key === 'Backspace' && end === groupEnd) {
      selectedGroup = null
      activePane = 'groups'
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
