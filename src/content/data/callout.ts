export const ICONS: Record<string, { icon?: string; color?: string; svg?: string }> = {
  info: {
    icon: 'ℹ️',
    color: 'rgba(2, 122, 255, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-lightbulb svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-lightbulb"></use></svg>'
  },
  tip: {
    icon: '💡',
    color: 'rgba(0, 191, 188, 0.06)',
    svg: '<svg class="fa d-icon d-icon-fire-flame-curved svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire-flame-curved"></use></svg>'
  },
  faq: {
    icon: '❓',
    color: 'rgba(236, 117, 0, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  question: {
    icon: '🤔',
    color: 'rgba(236, 117, 0, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  note: {
    icon: '📝',
    color: 'rgba(8, 109, 221, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-pen-to-square svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-pen-to-square"></use></svg>'
  },
  abstract: {
    icon: '📋',
    color: 'rgba(0, 191, 188, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-clipboard svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-clipboard"></use></svg>'
  },
  todo: {
    icon: '☑️',
    color: 'rgba(2, 122, 255, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-circle-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-check"></use></svg>'
  },
  success: {
    icon: '🎉',
    color: 'rgba(68, 207, 110, 0.06)',
    svg: '<svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#check"></use></svg>'
  },
  warning: {
    icon: '⚠️',
    color: 'rgba(236, 117, 0, 0.06)',
    svg: '<svg class="fa d-icon d-icon-triangle-exclamation svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#triangle-exclamation"></use></svg>'
  },
  failure: {
    icon: '❌',
    color: 'rgba(233, 49, 71, 0.06)',
    svg: '<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>'
  },
  danger: {
    icon: '☠️',
    color: 'rgba(233, 49, 71, 0.06)',
    svg: '<svg class="fa d-icon d-icon-bolt svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bolt"></use></svg>'
  },
  bug: {
    icon: '🐛',
    color: 'rgba(233, 49, 71, 0.06)',
    svg: '<svg class="fa d-icon d-icon-bug svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bug"></use></svg>'
  },
  example: {
    icon: '🔎',
    color: 'rgba(120, 82, 238, 0.06)',
    svg: '<svg class="fa d-icon d-icon-list svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#list"></use></svg>'
  },
  quote: {
    icon: '💬',
    color: 'rgba(158, 158, 158, 0.06)',
    svg: '<svg class="fa d-icon d-icon-quote-left svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#quote-left"></use></svg>'
  }
}

export const calloutKeywords = [
  'note',
  'abstract',
  'summary',
  'tldr',
  'info',
  'todo',
  'tip',
  'hint',
  'success',
  'check',
  'done',
  'question',
  'help',
  'faq',
  'warning',
  'caution',
  'attention',
  'failure',
  'fail',
  'missing',
  'danger',
  'error',
  'bug',
  'example',
  'quote',
  'cite'
].sort()
