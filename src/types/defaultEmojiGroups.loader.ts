import type { DefaultEmojiData, EmojiGroup } from './emoji'

// Runtime loader: fetch runtime JSON from /assets/defaultEmojiGroups.json
// Returns empty defaults if fetch fails.

async function fetchPackagedJSON(): Promise<DefaultEmojiData | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch('/assets/defaultEmojiGroups.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    return data as DefaultEmojiData
  } catch (err) {
    return null
  }
}

export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON()
  if (packaged && Array.isArray(packaged.groups)) return packaged.groups
  return []
}

export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  const packaged = await fetchPackagedJSON()
  if (packaged) return packaged
  return {
    groups: await loadDefaultEmojiGroups(),
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
      tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
    }
  } as unknown as DefaultEmojiData
}
