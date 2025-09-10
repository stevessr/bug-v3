export function isImageUrl(value: string | null | undefined): boolean {
  if (!value) return false

  let v = value.trim()

  // Support CSS url("...") / url('...') / url(...) formats
  if (/^url\(/i.test(v)) {
    const inner = v
      .replace(/^url\(/i, '')
      .replace(/\)$/, '')
      .trim()
    // strip quotes
    if (
      (inner.startsWith('"') && inner.endsWith('"')) ||
      (inner.startsWith("'") && inner.endsWith("'"))
    ) {
      v = inner.slice(1, -1).trim()
    } else {
      v = inner
    }
  }

  // Accept data URIs (base64) directly
  if (v.startsWith('data:image/')) return true

  // Accept blob/object URLs
  if (v.startsWith('blob:')) return true

  // Protocol-relative URLs (//example.com/...) — assume https
  if (v.startsWith('//')) v = 'https:' + v

  // Quick check for common image filename patterns anywhere in the string
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(v)) return true

  try {
    const url = new URL(v)
    const protocol = url.protocol
    // Allow http/https and extension-like checks
    if (protocol === 'http:' || protocol === 'https:' || protocol.endsWith(':')) {
      // if pathname ends with common image extension it's an image
      if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(url.pathname)) return true

      // Some image endpoints don't include extension but include typical query params
      if (/format=|ext=|type=image|image_type=/i.test(url.search)) return true
    }
  } catch {
    // ignore parse errors and fall through
  }

  return false
}

// Normalize an image URL-like string for safe use in <img src="...">.
// - strips surrounding url(...) wrapper
// - strips surrounding single/double quotes
// - converts protocol-relative URLs to https
// - returns trimmed string (or original falsy input as-is)
export function normalizeImageUrl(value: string | null | undefined): string {
  if (!value) return ''
  let v = value.trim()

  // Strip CSS url(...) wrapper
  if (/^url\(/i.test(v)) {
    let inner = v
      .replace(/^url\(/i, '')
      .replace(/\)$/, '')
      .trim()
    if (
      (inner.startsWith('"') && inner.endsWith('"')) ||
      (inner.startsWith("'") && inner.endsWith("'"))
    ) {
      inner = inner.slice(1, -1).trim()
    }
    v = inner
  }

  // Strip wrapping quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }

  if (!v) return ''

  if (v.startsWith('//')) v = 'https:' + v

  return v
}
