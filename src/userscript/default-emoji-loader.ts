import type { DefaultEmojiData, EmojiGroup, Emoji } from '../types/type'

// This is a userscript-specific loader for default emoji groups.
// It fetches the default emoji groups and filters them based on the hostname.

async function fetchManifest(url?: string): Promise<{ groups: Array<{ id: string, order: number }> } | null> {
  try {
    if (typeof fetch === 'undefined') return null
    // In a userscript context, we might be fetching from a different origin.
    // Omit credentials to avoid CORS issues.
    const manifestUrl = url ? `${url}/manifest.json` : 'https://video2gif-pages.pages.dev/assets/json/manifest.json'
    const res = await fetch(manifestUrl, {
      cache: 'no-cache',
      credentials: 'omit'
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
    const fileName = url ? `${url}/${groupId}.json` : `https://video2gif-pages.pages.dev/assets/json/${groupId}.json`
    const res = await fetch(fileName, {
      cache: 'no-cache',
      credentials: 'omit'
    })
    if (!res.ok) return null
    const data = await res.json()
    return data as EmojiGroup
  } catch (err) {
    return null
  }
}

export async function loadAndFilterDefaultEmojiGroups(
  url?: string,
  hostname?: string
): Promise<EmojiGroup[]> {
  try {
    // Fetch the manifest to get the list of groups
    const manifest = await fetchManifest(url)
    if (!manifest || !Array.isArray(manifest.groups)) {
      return []
    }
    
    // Load each group based on the manifest
    const allGroups = await Promise.all(
      manifest.groups.map(async (groupInfo) => {
        return await fetchGroup(groupInfo.id, url)
      })
    )
    
    // Filter out any null results
    const validGroups = allGroups.filter((group): group is EmojiGroup => group !== null)
    
    if (!hostname) {
      return validGroups
    }

    const filteredGroups = validGroups
      .map(group => {
        const filteredEmojis = group.emojis.filter(emoji => {
          try {
            const url = (emoji as Emoji).url
            if (!url) return false
            const emojiHostname = new URL(url).hostname
            return emojiHostname === hostname || emojiHostname.endsWith('.' + hostname)
          } catch (e) {
            // If new URL() fails, it's likely a relative URL.
            // A relative URL is on the same host, so it should be included.
            return true
          }
        })

        return {
          ...group,
          emojis: filteredEmojis
        }
      })
      .filter(group => group.emojis.length > 0)

    return filteredGroups
  } catch (err) {
    console.warn('Error loading and filtering default emoji groups:', err)
    return []
  }
}
