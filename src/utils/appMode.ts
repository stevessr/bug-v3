export type ExtensionSurface = 'popup' | 'options' | 'sidebar'

export interface ExtensionSurfaceResolution {
  surface: ExtensionSurface
  requestedTab: string | null
}

const isExtensionSurface = (value: string | null): value is ExtensionSurface =>
  value === 'popup' || value === 'options' || value === 'sidebar'

/**
 * Resolve the extension surface before Vue is loaded.
 *
 * `type` is used by in-extension links while `mode` is still present in the
 * published manifest. Supporting both keeps old links working and lets the
 * bootstrap load exactly one surface bundle.
 */
export function resolveExtensionSurface(
  search: string,
  hash = ''
): ExtensionSurfaceResolution {
  const params = new URLSearchParams(search)
  const type = params.get('type')
  const mode = params.get('mode')
  const explicitSurface = isExtensionSurface(type)
    ? type
    : isExtensionSurface(mode)
      ? mode
      : null
  const requestedTab = params.get('tabs')?.trim() || null
  const hasOptionsHash = /^#\/.+/.test(hash)

  // Sidebar is an explicit browser surface and must not be replaced by stale
  // route state. Any other routed URL belongs to the options application.
  if (explicitSurface === 'sidebar') {
    return { surface: 'sidebar', requestedTab }
  }
  if (requestedTab || hasOptionsHash) {
    return { surface: 'options', requestedTab }
  }

  return {
    surface: explicitSurface ?? 'popup',
    requestedTab
  }
}

export function applyExtensionSurfaceClass(surface: ExtensionSurface): void {
  if (typeof document === 'undefined') return
  document.body.classList.remove('options-mode', 'popup-mode', 'sidebar-mode')
  document.body.classList.add(`${surface}-mode`)
}
