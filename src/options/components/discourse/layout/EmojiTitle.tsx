import { computed, defineComponent, ref, shallowRef, watch } from 'vue'

import { fetchDiscourseEmojiGroups } from '../linux.do/emojis'

import '../css/EmojiTitle.css'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

type EmojiUrlMap = Record<string, string>

const shortcodePattern = /:([a-zA-Z0-9_+\-\u4e00-\u9fa5]+):/g

type DiscourseSanitizer = (value: unknown) => string

let sanitizerModulePromise: Promise<typeof import('../sanitizeHtml')> | null = null

const loadDiscourseSanitizer = () => {
  if (!sanitizerModulePromise) {
    sanitizerModulePromise = import('../sanitizeHtml').catch(error => {
      sanitizerModulePromise = null
      throw error
    })
  }
  return sanitizerModulePromise
}

const isSafeEmojiUrl = (value: string) => {
  try {
    const baseUrl = typeof document === 'undefined' ? undefined : document.baseURI
    const protocol = new URL(value, baseUrl).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Resolve known shortcodes only in text nodes. Apart from avoiding an XSS
 * boundary bypass, this deliberately returns the contents of its container
 * rather than `document.body.innerHTML`: returning the latter wraps a plain
 * title in a block `<div>`, which makes an inline emoji and its title text
 * incorrectly break onto separate lines.
 */
const replaceTitleEmojiShortcodes = (html: string, emojiUrls: EmojiUrlMap) => {
  if (!html || !html.includes(':') || !Object.keys(emojiUrls).length) return html
  if (typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = html
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.nodeValue?.includes(':')) textNodes.push(node)
  }

  textNodes.forEach(node => {
    const text = node.nodeValue || ''
    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    let replaced = false

    for (const match of text.matchAll(shortcodePattern)) {
      const start = match.index ?? 0
      // Match the forum's escaped-shortcode behavior without consuming the
      // surrounding characters, so adjacent `:one::two:` emojis still work.
      if (start > 0 && text[start - 1] === '\\') continue
      const name = match[1]
      const url = emojiUrls[name]
      if (!url || !isSafeEmojiUrl(url)) continue

      fragment.append(document.createTextNode(text.slice(lastIndex, start)))
      const image = document.createElement('img')
      image.className = 'emoji emoji-inline'
      image.src = url
      image.alt = name
      image.loading = 'lazy'
      fragment.append(image)
      lastIndex = start + match[0].length
      replaced = true
    }

    if (!replaced) return
    fragment.append(document.createTextNode(text.slice(lastIndex)))
    node.replaceWith(fragment)
  })

  return container.innerHTML
}

/**
 * Render a compact Discourse title while resolving site-specific `:shortcode:`
 * values. Titles arrive both as plain text and as `fancy_title` HTML, so the
 * caller explicitly selects the latter via `html` and this component keeps the
 * same sanitization boundary as post content.
 */
export default defineComponent({
  name: 'EmojiTitle',
  props: {
    text: { type: String, required: true },
    baseUrl: { type: String, required: true },
    html: { type: Boolean, default: false },
    className: { type: String, default: '' }
  },
  setup(props) {
    const emojiUrls = ref<EmojiUrlMap>({})
    const sanitizer = shallowRef<DiscourseSanitizer | null>(null)
    let emojiRequestId = 0

    const ensureSanitizer = () => {
      if (sanitizer.value) return
      void loadDiscourseSanitizer()
        .then(module => {
          sanitizer.value = module.sanitizeDiscourseHtml
        })
        .catch(() => {
          // Plain escaped text remains a safe fallback if the lazy chunk fails.
        })
    }

    if (props.html) ensureSanitizer()

    const rendered = computed(() => {
      const sanitize = sanitizer.value
      const source = props.html && sanitize ? sanitize(props.text) : escapeHtml(props.text)
      const withEmoji = replaceTitleEmojiShortcodes(source, emojiUrls.value)
      return props.html && sanitize ? sanitize(withEmoji) : withEmoji
    })

    const loadEmojiShortcodes = async (baseUrl: string) => {
      const requestId = ++emojiRequestId
      if (!baseUrl) {
        emojiUrls.value = {}
        return
      }

      try {
        const groups = await fetchDiscourseEmojiGroups(baseUrl)
        if (requestId !== emojiRequestId) return
        const urls: EmojiUrlMap = {}
        groups.forEach(group => {
          group.emojis.forEach(emoji => {
            if (!emoji.url) return
            urls[emoji.name] = emoji.url
            urls[emoji.id] = emoji.url
          })
        })
        emojiUrls.value = urls
      } catch {
        if (requestId === emojiRequestId) emojiUrls.value = {}
      }
    }

    watch(
      () => props.html,
      value => {
        if (value) ensureSanitizer()
      }
    )

    watch(
      () => props.baseUrl,
      value => void loadEmojiShortcodes(value),
      { immediate: true }
    )

    return () => (
      <span class={['discourse-emoji-title', props.className]} innerHTML={rendered.value} />
    )
  }
})
