import type { DefaultEmojiData, EmojiGroup } from './type'

import { getDomainFilterPattern, filterEmojisByDomain } from '@/utils/domainValidator'

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

/**
 * Filter emoji groups based on current domain
 * If a domain pattern is active (e.g., on linux.do), only keep emojis from matching domains
 * Groups with no matching emojis are excluded entirely
 */
function filterGroupsByDomain(groups: EmojiGroup[]): EmojiGroup[] {
  const domainPattern = getDomainFilterPattern()

  // No filtering needed
  if (!domainPattern) {
    return groups
  }

  const filteredGroups: EmojiGroup[] = []

  for (const group of groups) {
    // Always keep the favorites group regardless of domain
    if (group.id === 'favorites') {
      filteredGroups.push(group)
      continue
    }

    // Filter emojis in this group by domain
    const filteredEmojis = filterEmojisByDomain(group.emojis, domainPattern)

    // Only include the group if it has at least one matching emoji
    if (filteredEmojis.length > 0) {
      filteredGroups.push({
        ...group,
        emojis: filteredEmojis
      })
    }
  }

  return filteredGroups
}

export async function loadDefaultEmojiGroups(url?: string): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON(url)
  if (packaged && Array.isArray(packaged.groups)) {
    return filterGroupsByDomain(packaged.groups)
  }
  return []
}

export async function loadPackagedDefaults(url?: string): Promise<DefaultEmojiData> {
  const packaged = await fetchPackagedJSON(url)
  if (packaged) {
    // Apply domain filtering to the groups
    return {
      ...packaged,
      groups: filterGroupsByDomain(packaged.groups)
    }
  }
  // If fetch failed, return empty defaults with no groups (already filtered)
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
  } as unknown as DefaultEmojiData
}
