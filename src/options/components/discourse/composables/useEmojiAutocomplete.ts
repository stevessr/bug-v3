import { ref } from 'vue'
import type { EditorView } from 'prosemirror-view'

import { searchEmojis, type EmojiShortcode } from '../bbcode'

type UseEmojiAutocompleteOptions = {
  getEditorView: () => EditorView | null
  insertEmojiShortcode: (name: string) => void
}

export function useEmojiAutocomplete(options: UseEmojiAutocompleteOptions) {
  const showEmojiAutocomplete = ref(false)
  const emojiSuggestions = ref<EmojiShortcode[]>([])
  const emojiActiveIndex = ref(0)
  const emojiAutocompletePos = ref<{ x: number; y: number } | null>(null)
  const emojiAutocompleteRef = ref<HTMLElement | null>(null)

  const insertEmojiFromAutocomplete = (name: string) => {
    const editorView = options.getEditorView()
    if (!editorView) return
    const { state, dispatch } = editorView
    const { from } = state.selection
    const textBefore = state.doc.textBetween(0, from, '\n', '\n')
    const match = textBefore.match(/(^|\\s):([a-zA-Z0-9_\\u4e00-\\u9fa5+-]*)$/)
    if (!match) {
      options.insertEmojiShortcode(name)
      return
    }
    const tokenLength = match[2].length + 1
    const start = from - tokenLength
    const tr = state.tr.replaceWith(start, from, state.schema.text(`:${name}:`))
    dispatch(tr)
    editorView.focus()
  }

  const scrollActiveEmojiIntoView = () => {
    const host = emojiAutocompleteRef.value
    if (!host) return
    const activeItem = host.querySelector('.emoji-autocomplete-item.active') as HTMLElement | null
    activeItem?.scrollIntoView({ block: 'nearest' })
  }

  const updateEmojiAutocomplete = () => {
    const editorView = options.getEditorView()
    if (!editorView) return
    const { state } = editorView
    const { from } = state.selection
    const textBefore = state.doc.textBetween(0, from, '\n', '\n')
    const match = textBefore.match(/(^|\\s):([a-zA-Z0-9_\\u4e00-\\u9fa5+-]*)$/)
    if (!match) {
      showEmojiAutocomplete.value = false
      emojiSuggestions.value = []
      return
    }
    const query = match[2] || ''
    const results = searchEmojis(query).slice(0, 12)
    emojiSuggestions.value = results
    emojiActiveIndex.value = 0
    if (results.length === 0) {
      showEmojiAutocomplete.value = false
      return
    }
    try {
      const coords = editorView.coordsAtPos(from)
      emojiAutocompletePos.value = { x: coords.left, y: coords.bottom + 8 }
    } catch {
      emojiAutocompletePos.value = null
    }
    showEmojiAutocomplete.value = true
    requestAnimationFrame(() => {
      scrollActiveEmojiIntoView()
    })
  }

  const handleEditorKeydown = (event: KeyboardEvent) => {
    if (!showEmojiAutocomplete.value || emojiSuggestions.value.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      emojiActiveIndex.value = (emojiActiveIndex.value + 1) % emojiSuggestions.value.length
      requestAnimationFrame(() => {
        scrollActiveEmojiIntoView()
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      emojiActiveIndex.value =
        (emojiActiveIndex.value - 1 + emojiSuggestions.value.length) % emojiSuggestions.value.length
      requestAnimationFrame(() => {
        scrollActiveEmojiIntoView()
      })
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      const selected = emojiSuggestions.value[emojiActiveIndex.value]
      if (selected) {
        insertEmojiFromAutocomplete(selected.name)
        showEmojiAutocomplete.value = false
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      showEmojiAutocomplete.value = false
    }
  }

  const handleEditorKeyup = (event: KeyboardEvent) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === 'Tab' ||
      event.key === 'Escape'
    ) {
      return
    }
    updateEmojiAutocomplete()
  }

  return {
    showEmojiAutocomplete,
    emojiSuggestions,
    emojiActiveIndex,
    emojiAutocompletePos,
    emojiAutocompleteRef,
    updateEmojiAutocomplete,
    handleEditorKeydown,
    handleEditorKeyup,
    insertEmojiFromAutocomplete
  }
}
