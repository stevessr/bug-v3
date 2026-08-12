type DiscoursePreloadedData = Record<string, unknown>

let cachedElement: HTMLElement | null = null
let cachedData: DiscoursePreloadedData | null = null
let cacheInitialized = false
let observer: MutationObserver | null = null

function invalidateCache() {
  cachedData = null
  cacheInitialized = false
}

function observePreloadedElement(element: HTMLElement | null) {
  if (element === cachedElement) return

  observer?.disconnect()
  observer = null
  cachedElement = element
  invalidateCache()

  if (!element || typeof MutationObserver === 'undefined') return
  observer = new MutationObserver(invalidateCache)
  observer.observe(element, {
    attributes: true,
    attributeFilter: ['data-preloaded'],
    childList: true,
    characterData: true,
    subtree: true
  })
}

/**
 * Read Discourse's bootstrap script in both forms emitted by supported
 * versions: older builds use `data-preloaded`, while current builds render a
 * JSON script body (`<script id="data-preloaded" type="application/json">`).
 */
export function getDiscoursePreloadedData(): DiscoursePreloadedData | null {
  const preloaded = document.getElementById('data-preloaded') as HTMLElement | null
  observePreloadedElement(preloaded)
  if (cacheInitialized) return cachedData

  // `data-preloaded` can be several megabytes on active sites. Do not call
  // `textContent` / JSON.parse again for every PAGE_FETCH; a MutationObserver
  // invalidates this cache if Discourse replaces or changes the bootstrap tag.
  const raw = preloaded?.dataset?.preloaded || preloaded?.textContent || ''

  if (!raw) {
    cacheInitialized = true
    return null
  }

  try {
    const data = JSON.parse(raw)
    cachedData = data && typeof data === 'object' && !Array.isArray(data) ? data : null
  } catch {
    cachedData = null
  }
  cacheInitialized = true

  return cachedData
}

/** Discourse serializes most individual preload values as JSON strings. */
export function getDiscoursePreloadedValue(...keys: string[]): unknown | undefined {
  const data = getDiscoursePreloadedData()
  if (!data) return undefined

  for (const key of keys) {
    const value = data[key]
    if (value === undefined) continue
    if (typeof value !== 'string') return value

    try {
      return JSON.parse(value)
    } catch {
      // A malformed value must not be treated as usable bootstrap data.
    }
  }

  return undefined
}

export function getDiscoursePreloadedRecord(...keys: string[]): Record<string, unknown> | null {
  const value = getDiscoursePreloadedValue(...keys)
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
