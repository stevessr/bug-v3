import type { DefaultEmojiData, EmojiGroup } from './type'

// Runtime loader: fetch runtime JSON from /assets/defaultEmojiGroups.json
// Returns empty defaults if fetch fails.

async function fetchPackagedJSON(url?: string): Promise<DefaultEmojiData | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch(url || '/assets/defaultEmojiGroups.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    return data as DefaultEmojiData
  } catch (err) {
    return null
  }
}

export async function loadDefaultEmojiGroups(url?: string): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON(url)
  if (packaged && Array.isArray(packaged.groups)) return packaged.groups
  return []
}

export async function loadPackagedDefaults(url?: string): Promise<DefaultEmojiData> {
  const packaged = await fetchPackagedJSON(url)
  if (packaged) return packaged
  return {
    groups: await loadDefaultEmojiGroups(url),
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
      tenorApiKey: ''
    }
  } as unknown as DefaultEmojiData
}
