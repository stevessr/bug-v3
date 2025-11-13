import type { DefaultEmojiData, EmojiGroup } from './type'

// Runtime loader: fetch runtime JSON from /assets/json/settings.json, manifest.json, and individual group JSONs
// Returns empty defaults if fetch fails.

async function fetchSettings(url?: string): Promise<any | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch(url || 'https://video2gif-pages.pages.dev/assets/json/settings.json', {
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
  url?: string
): Promise<{ groups: Array<{ id: string; order: number }> } | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch(url || 'https://video2gif-pages.pages.dev/assets/json/manifest.json', {
      cache: 'no-cache'
    })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch (err) {
    return null
  }
}

async function fetchGroup(groupId: string, url?: string): Promise<EmojiGroup | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const fileName = url
      ? `${url}/${groupId}.json`
      : `https://video2gif-pages.pages.dev/assets/json/${groupId}.json`
    const res = await fetch(fileName, { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    return { ...data, emojis: Array.isArray(data.emojis) ? data.emojis : [] } as EmojiGroup
  } catch (err) {
    return null
  }
}

export async function loadDefaultEmojiGroups(url?: string): Promise<EmojiGroup[]> {
  try {
    // Fetch the manifest to get the list of groups
    const manifest = await fetchManifest(url)
    if (!manifest || !Array.isArray(manifest.groups)) {
      return []
    }

    // Load each group based on the manifest
    const groups = await Promise.all(
      manifest.groups.map(async groupInfo => {
        return await fetchGroup(groupInfo.id, url)
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

export async function loadPackagedDefaults(url?: string): Promise<DefaultEmojiData> {
  try {
    const [settings, groups] = await Promise.all([fetchSettings(url), loadDefaultEmojiGroups(url)])

    return {
      groups,
      settings: {
        imageScale: 30,
        defaultGroup: 'nachoneko',
        showSearchBar: true,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        enableLinuxDoInjection: false,
        enableXcomExtraSelectors: true,
        lastModified: Date.now(),
        // NOTE: Tenor API key intentionally left empty for repository; set at runtime by consumers.
        tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8',
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
        enableLinuxDoInjection: false,
        enableXcomExtraSelectors: true,
        lastModified: Date.now(),
        // NOTE: Tenor API key intentionally left empty for repository; set at runtime by consumers.
        tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
      }
    } as DefaultEmojiData
  }
}

export async function loadGroup(groupId: string, url?: string): Promise<EmojiGroup | null> {
  return await fetchGroup(groupId, url)
}

export async function loadSettings(url?: string): Promise<any | null> {
  return await fetchSettings(url)
}
