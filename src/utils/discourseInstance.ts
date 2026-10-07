/** Canonicalize a Discourse instance URL entered in extension settings. */
export function normalizeDiscourseUploadOrigin(value: string): string {
  const input = value.trim()
  if (!input) throw new Error('请输入 Discourse 实例域名')
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    throw new Error('域名格式无效，请输入 https://forum.example.com')
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('仅支持实例根域名，例如 https://forum.example.com')
  }
  if (url.protocol === 'http:' && !isPrivateHost(url.hostname)) {
    throw new Error('公网 Discourse 实例必须使用 HTTPS')
  }
  return url.origin
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  )
    return true
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255))
    return false
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254)
  )
}
