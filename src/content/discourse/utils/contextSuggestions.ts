import { cachedState } from '../../data/state'
import { insertEmojiIntoEditor } from './editor'
import { getEmojiPickerImageUrl } from './pickerPerformance'

import { extractSemanticContext } from '@/utils/semanticContext'
import { semanticEmojiId, suggestEmojis } from '@/utils/semanticEmoji'
import type { Emoji } from '@/types/type'

const EDITOR_SELECTOR = [
  'textarea.d-editor-input',
  '.ProseMirror.d-editor-input',
  '#channel-composer',
  '.chat-composer__input',
  '.chat-composer [contenteditable="true"]'
].join(', ')

function findActiveEditor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const editor = target.closest(EDITOR_SELECTOR)
  if (!(editor instanceof HTMLElement) || !editor.isConnected) return null
  if (!(editor instanceof HTMLTextAreaElement) && !editor.isContentEditable) return null
  return editor
}

function readCurrentDraft(editor: HTMLElement): string {
  return editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText
}

/**
 * The automatic path requires a second, explicit consent switch.
 * Only captures the tail of the current editor's own draft after input pauses;
 * neither existing posts nor any other input fields are observed.
 */
export function initSemanticContextSuggestions(): () => void {
  if (
    !cachedState.settings.semanticSearchEnabled ||
    !cachedState.settings.semanticContextSuggestionsEnabled
  ) return () => {}

  const panel = document.createElement('div')
  panel.className = 'emoji-extension-context-suggestions'
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-label', '根据当前输入联想表情')
  panel.style.cssText = [
    'position:fixed',
    'z-index:8999998',
    'width:min(360px,calc(100vw - 16px))',
    'max-height:104px',
    'padding:8px',
    'border-radius:10px',
    'border:1px solid var(--primary-low-mid,#ccc)',
    'background:var(--secondary,#fff)',
    'color:var(--primary,#222)',
    'box-shadow:0 4px 16px rgba(0,0,0,.14)'
  ].join(';')
  panel.hidden = true
  const heading = document.createElement('div')
  heading.textContent = '✨ 根据当前输入联想'
  heading.style.cssText = 'font-size:11px;opacity:.8;margin-bottom:4px;'
  const list = document.createElement('div')
  list.style.cssText = 'display:flex;gap:5px;overflow-x:auto;'
  panel.append(heading, list)
  // Preserve editor focus/selection on suggestion clicks.
  panel.addEventListener('pointerdown', event => event.preventDefault())
  document.body.appendChild(panel)

  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let destroyed = false
  let focusedEditor: HTMLElement | null = null
  let suppressUntil = 0

  function hide() {
    panel.hidden = true
    list.replaceChildren()
  }

  function reposition(editor: HTMLElement) {
    const rect = editor.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const above = rect.top - 112
    const top = above >= 8 ? above : Math.min(window.innerHeight - 112, rect.bottom + 8)
    panel.style.left = left + 'px'
    panel.style.top = Math.max(8, top) + 'px'
  }

  const onInput = (event: Event) => {
    if (Date.now() < suppressUntil) return
    const editor = findActiveEditor(event.target)
    if (!editor) return
    focusedEditor = editor
    const query = extractSemanticContext(readCurrentDraft(editor))
    const current = ++generation
    if (timer) clearTimeout(timer)
    hide()
    if (!query) return

    timer = setTimeout(async () => {
      if (destroyed || !editor.isConnected || document.activeElement !== editor) return
      if (!cachedState.settings.semanticSearchEnabled ||
          !cachedState.settings.semanticContextSuggestionsEnabled) return
      const result = await suggestEmojis(
        query,
        cachedState.emojiGroups,
        cachedState.settings
      )
      if (destroyed || generation !== current ||
          !editor.isConnected || document.activeElement !== editor ||
          extractSemanticContext(readCurrentDraft(editor)) !== query) return
      if (result.error) return // Never disrupt typing on provider errors.
      const byId = new Map<string, Emoji>()
      for (const group of cachedState.emojiGroups) {
        for (const emoji of group.emojis || []) {
          if (emoji?.id && emoji.name) byId.set(semanticEmojiId(emoji), emoji)
        }
      }
      for (const match of result.matches.slice(0, 7)) {
        const emoji = byId.get(match.id)
        if (!emoji) continue
        const button = document.createElement('button')
        button.type = 'button'
        button.title = emoji.name
        button.setAttribute('aria-label', '插入表情：' + emoji.name)
        button.style.cssText =
          'display:flex;flex:none;flex-direction:column;align-items:center;width:45px;min-height:54px;gap:3px;'
        const image = document.createElement('img')
        image.src = getEmojiPickerImageUrl(emoji)
        image.alt = emoji.name
        image.width = 32
        image.height = 32
        image.loading = 'lazy'
        image.style.cssText = 'width:32px;height:32px;object-fit:contain;'
        const label = document.createElement('span')
        label.textContent = emoji.name
        label.style.cssText =
          'font-size:10px;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
        button.append(image, label)
        button.addEventListener('click', () => {
          if (destroyed || !editor.isConnected) return
          ++generation
          if (timer) clearTimeout(timer)
          hide()
          suppressUntil = Date.now() + 1500
          editor.focus()
          const context = editor.closest('.chat-composer') ||
            editor.matches('#channel-composer, .chat-composer__input') ? 'chat' : 'composer'
          void insertEmojiIntoEditor(emoji, context)
        })
        list.appendChild(button)
      }
      if (list.childElementCount) {
        reposition(editor)
        panel.hidden = false
      }
    }, 900)
  }

  const onFocusOut = () => {
    setTimeout(() => {
      if (destroyed || !focusedEditor || document.activeElement === focusedEditor) return
      ++generation
      if (timer) clearTimeout(timer)
      hide()
    }, 0)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !panel.hidden) {
      ++generation
      if (timer) clearTimeout(timer)
      hide()
    }
  }
  document.addEventListener('input', onInput, true)
  document.addEventListener('focusout', onFocusOut, true)
  document.addEventListener('keydown', onKeyDown, true)
  return () => {
    destroyed = true
    ++generation
    if (timer) clearTimeout(timer)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('focusout', onFocusOut, true)
    document.removeEventListener('keydown', onKeyDown, true)
    panel.remove()
  }
}
