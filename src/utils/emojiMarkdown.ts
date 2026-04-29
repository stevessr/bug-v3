import { getForumFromUrl } from './cdnMapping'

export interface EmojiMarkdownSource {
  url?: string | null
  short_url?: string | null
}

/**
 * Returns the best URL for the given source, preferring short_url.
 * Callers that need context-aware behavior (cross-forum insertion)
 * should use shouldUseShortUrl() + buildMarkdownImage() instead.
 */
export function getPreferredEmojiMarkdownUrl(
  source: EmojiMarkdownSource | null | undefined
): string {
  const shortUrl = typeof source?.short_url === 'string' ? source.short_url.trim() : ''
  if (shortUrl) return shortUrl

  const url = typeof source?.url === 'string' ? source.url.trim() : ''
  return url
}

/**
 * Determine whether short_url is safe to use given the current page hostname.
 *
 * If the emoji's CDN domain maps to a known forum, short_url only resolves on
 * that forum. Cross-forum insertion (e.g. pasting a Linux.do emoji on another
 * Discourse instance) must use the direct URL instead — otherwise the target
 * forum's /uploads/lookup-urls endpoint will return [] and the image won't show.
 */
export function shouldUseShortUrl(
  emoji: EmojiMarkdownSource,
  currentHostname: string
): boolean {
  if (!emoji.short_url) return false
  const url = emoji.url
  if (!url) return false

  const sourceForum = getForumFromUrl(url)
  if (!sourceForum) {
    // CDN domain not in our map — can't judge, allow short_url (preserves existing behavior)
    return true
  }

  const currentForum = getForumFromUrl(`https://${currentHostname}`)
  return currentForum === sourceForum
}

export function buildMarkdownImage(
  alt: string,
  source: EmojiMarkdownSource | null | undefined
): string {
  const url = getPreferredEmojiMarkdownUrl(source)
  if (!url) return ''
  return `![${alt}](${url})`
}
