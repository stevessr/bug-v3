export function isLikelyUrl(s: string | undefined | null) {
  if (!s) return false
  try {
    return /^https?:\/\//i.test(s) || s.startsWith('//')
  } catch (_) {
    return false
  }
}

export function stringifyIcon(u: any) {
  try {
    if (!u) return ''
    if (typeof u === 'string') return u
    if (u && typeof u.toString === 'function') return String(u.toString())
    return String(u)
  } catch (_) {
    return ''
  }
}

export default { isLikelyUrl, stringifyIcon }
