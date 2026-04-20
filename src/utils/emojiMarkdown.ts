export interface EmojiMarkdownSource {
  url?: string | null
  short_url?: string | null
}

export function getPreferredEmojiMarkdownUrl(
  source: EmojiMarkdownSource | null | undefined
): string {
  const shortUrl = typeof source?.short_url === 'string' ? source.short_url.trim() : ''
  if (shortUrl) return shortUrl

  const url = typeof source?.url === 'string' ? source.url.trim() : ''
  return url
}

export function buildMarkdownImage(
  alt: string,
  source: EmojiMarkdownSource | null | undefined
): string {
  const url = getPreferredEmojiMarkdownUrl(source)
  if (!url) return ''
  return `![${alt}](${url})`
}
