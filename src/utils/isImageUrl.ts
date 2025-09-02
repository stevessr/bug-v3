export function isImageUrl(value: string | null | undefined): boolean {
  if (!value) return false
  // Accept data URIs (base64) directly
  if (typeof value === 'string' && value.startsWith('data:image/')) return true
  try {
    const url = new URL(value)
    // Accept http(s) with common image extensions
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url.pathname)
    }
    return false
  } catch {
    return false
  }
}
