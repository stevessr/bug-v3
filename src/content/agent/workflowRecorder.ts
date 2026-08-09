import { isSensitiveAgentFieldDescriptor } from '@/agent/permissionPolicy'
import type { AgentAction } from '@/agent/types'
import type { AgentWorkflowRecordedEvent } from '@/agent/browserWorkflows'

const INPUT_DEBOUNCE_MS = 350
const SCROLL_DEBOUNCE_MS = 250
const URL_POLL_MS = 500
const MAX_INPUT_LENGTH = 20_000

let recordingEnabled = false
let lastScrollX = 0
let lastScrollY = 0
let lastObservedUrl = ''
let scrollTimer: ReturnType<typeof setTimeout> | null = null
let urlTimer: ReturnType<typeof setInterval> | null = null

const pendingInputs = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
const redactedSelectors = new Set<string>()

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `recorded-${Date.now()}-${Math.random().toString(16).slice(2)}`

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''

const cssEscape = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, match => `\\${match}`)
}

const cssAttributeValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const isUniqueSelector = (selector: string, element: Element): boolean => {
  try {
    const matches = document.querySelectorAll(selector)
    return matches.length === 1 && matches[0] === element
  } catch {
    return false
  }
}

const stableClassNames = (element: Element) =>
  [...element.classList]
    .filter(name => name.length <= 60 && !/\d{4,}|^(active|focus|hover|selected)$/i.test(name))
    .slice(0, 2)

const selectorPart = (element: Element): string => {
  const tag = element.tagName.toLowerCase()
  const classes = stableClassNames(element)
  let part = `${tag}${classes.map(name => `.${cssEscape(name)}`).join('')}`
  const parent = element.parentElement
  if (parent) {
    const siblings = [...parent.children].filter(sibling => sibling.tagName === element.tagName)
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(element) + 1})`
  }
  return part
}

export function buildRecordedElementSelector(element: Element): string {
  if (element.id) {
    const byId = `#${cssEscape(element.id)}`
    if (isUniqueSelector(byId, element)) return byId
  }

  for (const attribute of ['data-testid', 'data-test', 'data-qa', 'name', 'aria-label']) {
    const value = element.getAttribute(attribute)
    if (!value || value.length > 120) continue
    const candidate = `${element.tagName.toLowerCase()}[${attribute}="${cssAttributeValue(value)}"]`
    if (isUniqueSelector(candidate, element)) return candidate
  }

  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== document.documentElement && parts.length < 6) {
    parts.unshift(selectorPart(current))
    const candidate = parts.join(' > ')
    if (isUniqueSelector(candidate, element)) return candidate
    if (current.parentElement?.id) {
      const scoped = `#${cssEscape(current.parentElement.id)} > ${candidate}`
      if (isUniqueSelector(scoped, element)) return scoped
    }
    current = current.parentElement
  }

  return parts.join(' > ') || element.tagName.toLowerCase()
}

const isExtensionElement = (element: Element) =>
  Boolean(
    element.closest(
      '[data-emoji-extension], #emoji-ext-toast-container, [id^="emoji-ext-"], [class*="emoji-extension"]'
    )
  )

const findActionElement = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element) || isExtensionElement(target)) return null
  const interactive = target.closest(
    'a, button, input, textarea, select, summary, [role="button"], [role="link"], [role="menuitem"], [contenteditable="true"]'
  )
  return (interactive || target) as HTMLElement
}

const elementLabel = (element: HTMLElement): string => {
  const aria = element.getAttribute('aria-label')
  const title = element.getAttribute('title')
  const placeholder = element.getAttribute('placeholder')
  const text =
    element instanceof HTMLInputElement
      ? ['button', 'submit', 'reset'].includes(element.type)
        ? element.value
        : ''
      : element instanceof HTMLTextAreaElement
        ? ''
        : element.textContent
  return cleanText(aria || title || placeholder || text, 120)
}

const sensitiveDescriptor = (element: HTMLElement): string => {
  const input = element as HTMLInputElement
  const associatedLabel =
    input.labels && input.labels.length > 0
      ? [...input.labels].map(label => label.textContent || '').join(' ')
      : ''
  return [
    element.tagName,
    element.id,
    element.getAttribute('type'),
    element.getAttribute('name'),
    element.getAttribute('autocomplete'),
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder'),
    associatedLabel
  ]
    .filter(Boolean)
    .join(' ')
}

export function isRecordedFieldSensitive(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && element.type === 'file') return true
  return isSensitiveAgentFieldDescriptor(sensitiveDescriptor(element))
}

const sendRecordedEvent = async (event: AgentWorkflowRecordedEvent) => {
  if (!recordingEnabled || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
  try {
    await chrome.runtime.sendMessage({ type: 'AGENT_RECORDING_EVENT', event })
  } catch {
    // A navigation can tear down the document while the message is in flight.
  }
}

const recordAction = (action: AgentAction) => {
  void sendRecordedEvent({
    kind: 'action',
    action,
    url: location.href,
    recordedAt: Date.now()
  })
}

const readEditableValue = (element: HTMLElement): string => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value.slice(0, MAX_INPUT_LENGTH)
  }
  return (element.textContent || '').slice(0, MAX_INPUT_LENGTH)
}

const flushInput = (element: HTMLElement) => {
  const timer = pendingInputs.get(element)
  if (timer) clearTimeout(timer)
  pendingInputs.delete(element)
  if (!recordingEnabled || !element.isConnected) return

  const selector = buildRecordedElementSelector(element)
  if (isRecordedFieldSensitive(element)) {
    if (redactedSelectors.has(selector)) return
    redactedSelectors.add(selector)
    void sendRecordedEvent({
      kind: 'redacted-input',
      selector,
      label: elementLabel(element) || '敏感输入字段',
      url: location.href,
      recordedAt: Date.now()
    })
    return
  }

  recordAction({
    id: makeId(),
    type: 'input',
    selector,
    text: readEditableValue(element),
    clear: true,
    note: elementLabel(element) || '填写输入框'
  })
}

const handleInput = (event: Event) => {
  if (!event.isTrusted) return
  const element = findActionElement(event.target)
  if (!element) return
  if (element instanceof HTMLSelectElement) return
  if (element instanceof HTMLInputElement) {
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'image'].includes(element.type)) return
  }
  const existing = pendingInputs.get(element)
  if (existing) clearTimeout(existing)
  pendingInputs.set(
    element,
    setTimeout(() => flushInput(element), INPUT_DEBOUNCE_MS)
  )
}

const handleFocusOut = (event: FocusEvent) => {
  if (!(event.target instanceof HTMLElement) || !pendingInputs.has(event.target)) return
  flushInput(event.target)
}

const handleChange = (event: Event) => {
  if (!event.isTrusted || !(event.target instanceof HTMLSelectElement)) return
  const element = event.target
  if (isExtensionElement(element)) return
  const selected = element.selectedOptions[0]
  recordAction({
    id: makeId(),
    type: 'select',
    selector: buildRecordedElementSelector(element),
    value: element.value,
    label: cleanText(selected?.textContent, 120),
    note: elementLabel(element) || '选择选项'
  })
}

const handleClick = (event: MouseEvent) => {
  if (!event.isTrusted || event.button !== 0) return
  const element = findActionElement(event.target)
  if (!element) return
  recordAction({
    id: makeId(),
    type: 'click-dom',
    selector: buildRecordedElementSelector(element),
    note: elementLabel(element) || `点击 ${element.tagName.toLowerCase()}`
  })
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!event.isTrusted || !['Enter', 'Escape'].includes(event.key)) return
  const element = findActionElement(event.target)
  if (!element) return
  recordAction({
    id: makeId(),
    type: 'key',
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    note: elementLabel(element) || `按下 ${event.key}`
  })
}

const flushScroll = () => {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = null
  if (!recordingEnabled) return
  const x = Math.round(window.scrollX - lastScrollX)
  const y = Math.round(window.scrollY - lastScrollY)
  lastScrollX = window.scrollX
  lastScrollY = window.scrollY
  if (x === 0 && y === 0) return
  recordAction({ id: makeId(), type: 'scroll', x, y, behavior: 'auto', note: '滚动页面' })
}

const handleScroll = (event: Event) => {
  if (event.target !== document && event.target !== document.documentElement) return
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(flushScroll, SCROLL_DEBOUNCE_MS)
}

const checkUrlChange = () => {
  if (!recordingEnabled || location.href === lastObservedUrl) return
  lastObservedUrl = location.href
  recordAction({
    id: makeId(),
    type: 'navigate',
    url: location.href,
    waitForLoad: true,
    note: '页面导航'
  })
}

const attachListeners = () => {
  lastScrollX = window.scrollX
  lastScrollY = window.scrollY
  lastObservedUrl = location.href
  document.addEventListener('click', handleClick, true)
  document.addEventListener('input', handleInput, true)
  document.addEventListener('change', handleChange, true)
  document.addEventListener('focusout', handleFocusOut, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('scroll', handleScroll, true)
  window.addEventListener('popstate', checkUrlChange)
  window.addEventListener('hashchange', checkUrlChange)
  urlTimer = setInterval(checkUrlChange, URL_POLL_MS)
}

const detachListeners = () => {
  for (const element of [...pendingInputs.keys()]) flushInput(element)
  flushScroll()
  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('input', handleInput, true)
  document.removeEventListener('change', handleChange, true)
  document.removeEventListener('focusout', handleFocusOut, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  document.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('popstate', checkUrlChange)
  window.removeEventListener('hashchange', checkUrlChange)
  if (urlTimer) clearInterval(urlTimer)
  urlTimer = null
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = null
  pendingInputs.clear()
  redactedSelectors.clear()
}

export function setWorkflowRecordingEnabled(enabled: boolean): void {
  if (recordingEnabled === enabled) return
  if (enabled) {
    recordingEnabled = true
    attachListeners()
    return
  }
  detachListeners()
  recordingEnabled = false
}

export function isWorkflowRecordingEnabled(): boolean {
  return recordingEnabled
}

export async function resumeWorkflowRecorderIfNeeded(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
  try {
    const response = await chrome.runtime.sendMessage({ type: 'AGENT_RECORDING_CONTENT_READY' })
    setWorkflowRecordingEnabled(response?.success === true && response?.data?.active === true)
  } catch {
    setWorkflowRecordingEnabled(false)
  }
}
