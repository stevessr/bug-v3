export function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) return '表情'
    return decoded || '表情'
  } catch {
    return '表情'
  }
}
