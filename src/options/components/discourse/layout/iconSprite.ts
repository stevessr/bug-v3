const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const MAX_SYMBOL_MARKUP_BYTES = 128 * 1024
const MAX_TOTAL_MARKUP_BYTES = 2 * 1024 * 1024

const SAFE_ICON_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const SAFE_FRAGMENT_URL = /^#[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const SAFE_PAINT =
  /^(?:none|currentColor|context-fill|context-stroke|inherit|transparent|var\(--[a-z0-9_-]+\)|#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^)]{1,128}\)|url\(#[A-Za-z0-9_.:-]+\))$/i

const ALLOWED_ELEMENTS = new Set([
  'symbol',
  'path',
  'circle',
  'rect',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'g',
  'defs',
  'clippath',
  'mask',
  'lineargradient',
  'radialgradient',
  'stop',
  'use',
  'title'
])

const ALLOWED_ATTRIBUTES = new Set([
  'id',
  'viewbox',
  'd',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'clip-path',
  'clip-rule',
  'mask',
  'opacity',
  'transform',
  'vector-effect',
  'preserveaspectratio',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'maskunits',
  'maskcontentunits',
  'href',
  'xlink:href'
])

type IconSpriteResponse = {
  success?: boolean
  data?: { symbols?: unknown }
  error?: string
}

const spriteRequests = new Map<string, Promise<string[]>>()

function normalizeIconId(icon?: string | null): string {
  const normalized = icon?.trim().replace(/^#/, '') || ''
  return SAFE_ICON_ID.test(normalized) ? normalized : ''
}

function normalizeBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin
  } catch {
    return ''
  }
}

function isSafeAttribute(name: string, value: string): boolean {
  if (!ALLOWED_ATTRIBUTES.has(name) || value.length > MAX_SYMBOL_MARKUP_BYTES) return false
  if (name === 'id') return SAFE_ICON_ID.test(value)
  if (name === 'href' || name === 'xlink:href') return SAFE_FRAGMENT_URL.test(value)
  if (name === 'fill' || name === 'stroke' || name === 'stop-color') {
    return SAFE_PAINT.test(value.trim())
  }
  if (name === 'clip-path' || name === 'mask') {
    return /^url\(#[A-Za-z0-9_.:-]+\)$/.test(value.trim())
  }
  return true
}

function cloneSafeElement(source: Element): Element | null {
  const tagName = source.localName.toLowerCase()
  if (!ALLOWED_ELEMENTS.has(tagName)) return null

  const clone = document.createElementNS(SVG_NAMESPACE, source.localName)
  for (const attribute of source.attributes) {
    const name = attribute.name.toLowerCase()
    if (!isSafeAttribute(name, attribute.value)) continue
    clone.setAttribute(attribute.name, attribute.value)
  }

  for (const child of source.children) {
    const safeChild = cloneSafeElement(child)
    if (safeChild) clone.appendChild(safeChild)
  }

  if (tagName === 'title' && source.textContent) {
    clone.textContent = source.textContent.slice(0, 256)
  }

  return clone
}

function requestSiteIconSymbols(baseUrl: string): Promise<string[]> {
  const chromeAPI = globalThis.chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    return Promise.reject(new Error('Discourse icon sprite unavailable: Chrome runtime missing'))
  }

  return new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(
      { type: 'GET_DISCOURSE_ICON_SPRITE', url: baseUrl },
      (response: IconSpriteResponse) => {
        const runtimeError = chromeAPI.runtime.lastError
        if (runtimeError) {
          reject(new Error(runtimeError.message || 'Failed to read the site icon sprite'))
          return
        }

        const symbols = response?.data?.symbols
        if (!response?.success || !Array.isArray(symbols)) {
          reject(new Error(response?.error || 'The site did not return an icon sprite'))
          return
        }

        resolve(symbols.filter((symbol): symbol is string => typeof symbol === 'string'))
      }
    )
  })
}

/** Use a same-document fragment supplied by the currently selected Discourse site. */
export function getDiscourseIconHref(icon?: string | null): string {
  const id = normalizeIconId(icon)
  return id ? `#${id}` : ''
}

export function loadDiscourseIconSymbols(baseUrl: string): Promise<string[]> {
  const origin = normalizeBaseUrl(baseUrl)
  if (!origin) return Promise.reject(new Error('Invalid Discourse base URL'))

  const cached = spriteRequests.get(origin)
  if (cached) return cached

  const request = requestSiteIconSymbols(origin).catch(error => {
    spriteRequests.delete(origin)
    throw error
  })
  spriteRequests.set(origin, request)
  return request
}

/**
 * Parse untrusted site markup as inert XML and rebuild only safe SVG elements
 * and attributes. No site markup is assigned through innerHTML.
 */
export function replaceDiscourseIconSymbols(
  container: SVGSVGElement,
  symbolMarkup: readonly string[]
): number {
  container.replaceChildren()

  const parser = new DOMParser()
  const seen = new Set<string>()
  let totalBytes = 0

  for (const markup of symbolMarkup) {
    if (!markup || markup.length > MAX_SYMBOL_MARKUP_BYTES) continue
    totalBytes += markup.length
    if (totalBytes > MAX_TOTAL_MARKUP_BYTES) break

    const documentNode = parser.parseFromString(
      `<svg xmlns="${SVG_NAMESPACE}" xmlns:xlink="http://www.w3.org/1999/xlink">${markup}</svg>`,
      'image/svg+xml'
    )
    if (documentNode.querySelector('parsererror')) continue

    const symbol = documentNode.documentElement.firstElementChild
    if (!symbol || symbol.localName.toLowerCase() !== 'symbol') continue

    const id = normalizeIconId(symbol.getAttribute('id'))
    if (!id || seen.has(id)) continue

    const safeSymbol = cloneSafeElement(symbol)
    if (!safeSymbol) continue
    safeSymbol.setAttribute('id', id)
    container.appendChild(safeSymbol)
    seen.add(id)
  }

  return seen.size
}
