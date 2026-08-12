import DOMPurify, { type Config } from 'dompurify'

const SPOTIFY_EMBED_PATH_RE =
  /^\/embed\/(?:album|artist|episode|playlist|show|track)\/[A-Za-z0-9]+\/?$/

/**
 * Cooked post content is otherwise intentionally iframe-free.  Spotify is a
 * narrowly scoped exception: accepting only its HTTPS embed endpoints keeps a
 * normal post from turning into an arbitrary third-party frame.
 */
export function isAllowedDiscourseEmbedIframeSrc(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'open.spotify.com' &&
      SPOTIFY_EMBED_PATH_RE.test(url.pathname)
    )
  } catch {
    return false
  }
}

const DISCOURSE_HTML_SANITIZE_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_TAGS: ['iframe'],
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'frameborder',
    'height',
    'loading',
    'referrerpolicy',
    'title',
    'width'
  ],
  FORBID_TAGS: [
    'base',
    'embed',
    'form',
    'input',
    'link',
    'meta',
    'object',
    'option',
    'select',
    'style',
    'textarea'
  ],
  FORBID_ATTR: ['autofocus', 'formaction', 'srcdoc']
}

DOMPurify.addHook('uponSanitizeElement', node => {
  if (node.nodeName.toLowerCase() !== 'iframe') return

  const frame = node as HTMLIFrameElement
  const src = frame.getAttribute('src') || ''
  if (!isAllowedDiscourseEmbedIframeSrc(src)) {
    frame.remove()
    return
  }

  frame.classList.add('spotify-embed')
  frame.setAttribute('title', frame.getAttribute('title') || 'Spotify 播放器')
  frame.setAttribute('loading', 'lazy')
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  frame.setAttribute(
    'allow',
    'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
  )
  frame.setAttribute('allowfullscreen', '')
})

export function sanitizeDiscourseHtml(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  return DOMPurify.sanitize(value, DISCOURSE_HTML_SANITIZE_CONFIG)
}
