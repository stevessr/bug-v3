import { getForumFromUrl } from './cdnMapping'
import { extractDiscourseUploadMetadata } from './discourseUpload'

export interface EmojiMarkdownSource {
  url?: string | null
  short_url?: string | null
  short_path?: string | null
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

export function getEmojiShortUrl(source: EmojiMarkdownSource | null | undefined): string | null {
  const explicit = typeof source?.short_url === 'string' ? source.short_url.trim() : ''
  return explicit || extractDiscourseUploadMetadata(source?.short_path).short_url || null
}

/**
 * Determine whether short_url is safe to use given the current page hostname.
 *
 * `short_url` is local to its source forum. Only insert it when the source and
 * current page resolve to the same forum host; another forum must use the
 * direct URL or its /uploads/lookup-urls endpoint cannot resolve the upload.
 */
export function shouldUseShortUrl(emoji: EmojiMarkdownSource, currentHostname: string): boolean {
  const shortUrl = emoji.short_url || extractDiscourseUploadMetadata(emoji.short_path).short_url
  if (!shortUrl) return false
  const url = emoji.url
  if (!url) return false

  const sourceForum = getForumFromUrl(url)
  const currentForum = getForumFromUrl(`https://${currentHostname}`)
  return Boolean(sourceForum && currentForum && currentForum === sourceForum)
}

export function buildMarkdownImage(
  alt: string,
  source: EmojiMarkdownSource | null | undefined
): string {
  const url = getPreferredEmojiMarkdownUrl(source)
  if (!url) return ''
  return `![${alt}](${url})`
}
