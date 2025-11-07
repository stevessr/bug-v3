import type { DefaultEmojiData, EmojiGroup, Emoji } from '../types/type'

// This is a userscript-specific loader for default emoji groups.
// It fetches the default emoji groups and filters them based on the hostname.

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

export async function loadAndFilterDefaultEmojiGroups(
  url?: string,
  hostname?: string
): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON(url)
  if (!packaged || !Array.isArray(packaged.groups)) return []

  if (!hostname) {
    return packaged.groups
  }

  const filteredGroups = packaged.groups
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
}
