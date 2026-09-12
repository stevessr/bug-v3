/**
 * Build the Firefox variant of the extension manifest.
 *
 * Chrome and Firefox intentionally share the same bundle, but their sidebar
 * and background implementations are different.  Keep the source manifest
 * Chrome-friendly and normalize it at XPI packaging time so the Firefox
 * artifact does not request unsupported Chromium-only permissions.
 */

export const FIREFOX_UNSUPPORTED_PERMISSIONS = new Set([
  'sidePanel',
  'debugger',
  'downloads.shelf',
  'downloads.ui'
])

const FIREFOX_UPDATE_URL = 'https://s.pwsh.us.kg/updates.json'
const FIREFOX_SIDEBAR_PATH = 'index.html?type=sidebar'

const clone = value => JSON.parse(JSON.stringify(value))

/**
 * @param {Record<string, any>} sourceManifest
 * @returns {Record<string, any>}
 */
export function createFirefoxManifest(sourceManifest) {
  const manifest = clone(sourceManifest)

  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = manifest.permissions.filter(
      permission => !FIREFOX_UNSUPPORTED_PERMISSIONS.has(permission)
    )
  }

  // Firefox exposes a sidebarAction UI instead of Chrome's sidePanel UI.
  delete manifest.side_panel
  manifest.sidebar_action = {
    default_panel: FIREFOX_SIDEBAR_PATH,
    default_title: manifest.name,
    default_icon: manifest.icons,
    ...(manifest.sidebar_action || {})
  }

  // Firefox MV3 uses an event page (`scripts`) and ignores the service worker
  // entry. Keep both keys so the same artifact remains valid for browsers that
  // implement MV3 with service workers as well.
  const background = manifest.background || {}
  const backgroundScript = background.service_worker || background.scripts?.[0]
  if (backgroundScript) {
    manifest.background = {
      scripts: [backgroundScript],
      ...(background.service_worker ? { service_worker: background.service_worker } : {}),
      ...(background.type ? { type: background.type } : {})
    }
  }

  manifest.browser_specific_settings = {
    ...(manifest.browser_specific_settings || {}),
    gecko: {
      ...(manifest.browser_specific_settings?.gecko || {}),
      update_url:
        manifest.browser_specific_settings?.gecko?.update_url || FIREFOX_UPDATE_URL,
      data_collection_permissions:
        manifest.browser_specific_settings?.gecko?.data_collection_permissions || {
          required: ['websiteActivity', 'websiteContent']
        }
    }
  }

  return manifest
}

