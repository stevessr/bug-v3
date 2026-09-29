import type { AppSettings, Emoji, EmojiGroup } from '@/types/type'
import { semanticEmojiId, suggestEmojis } from '@/utils/semanticEmoji'
import { getEmojiPickerImageUrl } from './pickerPerformance'

/**
 * Small recommendation rail for both injected Discourse pickers.
 * It observes ONLY the explicit picker search input; the composer/chat text is not read.
 */
export function attachSemanticPickerSearch(options: {
  input: HTMLInputElement
  parent: HTMLElement
  before: HTMLElement
  groups: EmojiGroup[]
  settings: AppSettings
  onSelect: (emoji: Emoji) => void
}): () => void {
  if (!options.settings.semanticSearchEnabled) return () => {}
  const rail = document.createElement('div')
  rail.className = 'emoji-semantic-suggestions'
  rail.style.cssText = 'padding:6px 10px;max-width:100%;overflow:hidden;'
  rail.hidden = true
  const heading = document.createElement('div')
  heading.style.cssText = 'font-size:12px;opacity:.8;margin-bottom:4px;'
  heading.textContent = '✨ AI 语义联想'
  const list = document.createElement('div')
  list.style.cssText = 'display:flex;overflow-x:auto;gap:6px;padding-bottom:3px;'
  rail.append(heading, list)
  options.parent.insertBefore(rail, options.before)

  const byId = new Map<string, Emoji>()
  for (const group of options.groups) {
    for (const emoji of group.emojis || []) {
      if (emoji?.id && emoji.name) byId.set(semanticEmojiId(emoji), emoji)
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let destroyed = false
  const onInput = () => {
    const current = ++generation
    if (timer) clearTimeout(timer)
    const query = options.input.value.trim()
    rail.hidden = true
    list.replaceChildren()
    if (query.length < 2) return
    timer = setTimeout(async () => {
      const result = await suggestEmojis(query, options.groups, options.settings)
      if (destroyed || current !== generation || options.input.value.trim() !== query) return
      if (result.error) {
        heading.textContent = '语义联想不可用：' + result.error
        rail.hidden = false
        return
      }
      heading.textContent = '✨ AI 语义联想'
      for (const match of result.matches.slice(0, 8)) {
        const emoji = byId.get(match.id)
        if (!emoji) continue
        const button = document.createElement('button')
        button.type = 'button'
        button.title = emoji.name
        button.setAttribute('aria-label', '插入表情：' + emoji.name)
        button.style.cssText =
          'flex:none;width:58px;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;'
        const img = document.createElement('img')
        img.alt = emoji.name
        img.width = 36
        img.height = 36
        img.loading = 'lazy'
        img.decoding = 'async'
        img.style.cssText = 'width:36px;height:36px;object-fit:contain;'
        img.src = getEmojiPickerImageUrl(emoji)
        const label = document.createElement('span')
        label.textContent = emoji.name
        label.style.cssText = 'width:100%;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
        button.append(img, label)
        button.addEventListener('click', event => {
          event.preventDefault()
          if (!destroyed) options.onSelect(emoji)
        })
        list.appendChild(button)
      }
      rail.hidden = list.childElementCount === 0
    }, 500)
  }
  options.input.addEventListener('input', onInput)
  return () => {
    destroyed = true
    ++generation
    if (timer) clearTimeout(timer)
    options.input.removeEventListener('input', onInput)
    rail.remove()
  }
}
