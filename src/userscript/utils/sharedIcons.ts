// Shared icon definitions used across multiple modules
export const ICONS: Record<string, { icon: string; color: string; svg: string }> = {
  info: {
    icon: 'ℹ️',
    color: 'rgba(2, 122, 255, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-lightbulb svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-lightbulb"></use></svg>'
  },
  tip: {
    icon: '💡',
    color: 'rgba(0, 191, 188, 0.1)',
    svg: '<svg class="fa d-icon d-icon-fire-flame-curved svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire-flame-curved"></use></svg>'
  },
  faq: {
    icon: '❓',
    color: 'rgba(236, 117, 0, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  question: {
    icon: '🤔',
    color: 'rgba(236, 117, 0, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  note: {
    icon: '📝',
    color: 'rgba(8, 109, 221, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-pen-to-square svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-pen-to-square"></use></svg>'
  },
  abstract: {
    icon: '📋',
    color: 'rgba(0, 191, 188, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-clipboard svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-clipboard"></use></svg>'
  },
  todo: {
    icon: '☑️',
    color: 'rgba(2, 122, 255, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-circle-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-check"></use></svg>'
  },
  success: {
    icon: '🎉',
    color: 'rgba(68, 207, 110, 0.1)',
    svg: '<svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#check"></use></svg>'
  },
  warning: {
    icon: '⚠️',
    color: 'rgba(236, 117, 0, 0.1)',
    svg: '<svg class="fa d-icon d-icon-triangle-exclamation svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#triangle-exclamation"></use></svg>'
  },
  failure: {
    icon: '❌',
    color: 'rgba(233, 49, 71, 0.1)',
    svg: '<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>'
  },
  danger: {
    icon: '☠️',
    color: 'rgba(233, 49, 71, 0.1)',
    svg: '<svg class="fa d-icon d-icon-bolt svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bolt"></use></svg>'
  },
  bug: {
    icon: '🐛',
    color: 'rgba(233, 49, 71, 0.1)',
    svg: '<svg class="fa d-icon d-icon-bug svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bug"></use></svg>'
  },
  example: {
    icon: '🔎',
    color: 'rgba(120, 82, 238, 0.1)',
    svg: '<svg class="fa d-icon d-icon-list svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#list"></use></svg>'
  },
  quote: {
    icon: '💬',
    color: 'rgba(158, 158, 158, 0.1)',
    svg: '<svg class="fa d-icon d-icon-quote-left svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#quote-left"></use></svg>'
  }
}

// Aliases
export const ALIASES: Record<string, string> = {
  summary: 'abstract',
  tldr: 'abstract',
  hint: 'tip',
  check: 'success',
  done: 'success',
  help: 'faq',
  caution: 'warning',
  attention: 'warning',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote'
}

// Get icon by key with fallback to aliases
export function getIcon(key: string) {
  const alias = ALIASES[key]
  const iconKey = alias || key
  return (
    ICONS[iconKey] || {
      icon: '📝',
      color: 'rgba(158, 158, 158, 0.1)',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
    }
  )
}
