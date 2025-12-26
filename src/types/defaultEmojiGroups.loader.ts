import type { DefaultEmojiData, EmojiGroup } from './type'

// Runtime loader: fetch runtime JSON from /assets/json/settings.json, manifest.json, and individual group JSONs
// Returns empty defaults if fetch fails.

// 获取云端市场基础 URL（从设置中读取域名，或使用默认值）
function getCloudMarketBaseUrl(customDomain?: string): string {
  const domain = customDomain || 'video2gif-pages.pages.dev'
  return `https://${domain}`
}

async function fetchSettings(customDomain?: string): Promise<any | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const baseUrl = getCloudMarketBaseUrl(customDomain)
    const res = await fetch(`${baseUrl}/assets/json/settings.json`, {
      cache: 'no-cache'
    })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch (err) {
    return null
  }
}

async function fetchManifest(
  customDomain?: string
): Promise<{ groups: Array<{ id: string; order: number }> } | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const baseUrl = getCloudMarketBaseUrl(customDomain)
    const res = await fetch(`${baseUrl}/assets/json/manifest.json`, {
      cache: 'no-cache'
    })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch (err) {
    return null
  }
}

async function fetchGroup(groupId: string, customDomain?: string): Promise<EmojiGroup | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const baseUrl = getCloudMarketBaseUrl(customDomain)
    const fileName = `${baseUrl}/assets/json/${groupId}.json`
    const res = await fetch(fileName, { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    return { ...data, emojis: Array.isArray(data.emojis) ? data.emojis : [] } as EmojiGroup
  } catch (err) {
    return null
  }
}

export async function loadDefaultEmojiGroups(customDomain?: string): Promise<EmojiGroup[]> {
  try {
    // Fetch the manifest to get the list of groups
    const manifest = await fetchManifest(customDomain)
    if (!manifest || !Array.isArray(manifest.groups)) {
      return []
    }

    // Load each group based on the manifest
    const groups = await Promise.all(
      manifest.groups.map(async groupInfo => {
        return await fetchGroup(groupInfo.id, customDomain)
      })
    )

    // Filter out any null results and sort by order
    const validGroups = groups.filter((group): group is EmojiGroup => group !== null)
    return validGroups.sort((a, b) => (a.order || 0) - (b.order || 0))
  } catch (err) {
    console.warn('Error loading default emoji groups:', err)
    return []
  }
}

export async function loadPackagedDefaults(customDomain?: string): Promise<DefaultEmojiData> {
  try {
    const [settings, groups] = await Promise.all([
      fetchSettings(customDomain),
      loadDefaultEmojiGroups(customDomain)
    ])

    return {
      groups,
      settings: {
        imageScale: 30,
        defaultGroup: 'nachoneko',
        showSearchBar: true,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        enableXcomExtraSelectors: true,
        lastModified: Date.now(),
        ...settings
      }
    } as DefaultEmojiData
  } catch (err) {
    console.warn('Error loading packaged defaults:', err)
    return {
      groups: [],
      settings: {
        imageScale: 30,
        defaultGroup: 'nachoneko',
        showSearchBar: true,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        enableXcomExtraSelectors: true,
        lastModified: Date.now()
      }
    } as DefaultEmojiData
  }
}

export async function loadGroup(
  groupId: string,
  customDomain?: string
): Promise<EmojiGroup | null> {
  return await fetchGroup(groupId, customDomain)
}

export async function loadSettings(customDomain?: string): Promise<any | null> {
  return await fetchSettings(customDomain)
}
