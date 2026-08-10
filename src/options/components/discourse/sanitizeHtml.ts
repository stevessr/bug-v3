import DOMPurify, { type Config } from 'dompurify'

const DISCOURSE_HTML_SANITIZE_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: [
    'base',
    'embed',
    'form',
    'iframe',
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

export function sanitizeDiscourseHtml(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  return DOMPurify.sanitize(value, DISCOURSE_HTML_SANITIZE_CONFIG)
}
