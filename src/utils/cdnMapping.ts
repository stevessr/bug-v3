/**
 * CDN domain → forum identity mapping.
 * Used to determine whether a short_url can be safely used cross-forum.
 */

export const CDN_DOMAIN_MAP: Record<string, string> = {
  'cdn.ldstatic.com': 'linux.do',
  'cdn2.ldstatic.com': 'linux.do',
  'cdn3.ldstatic.com': 'linux.do',
}

/**
 * Given a CDN domain, return the forum identity (e.g. "linux.do")
 * or undefined if not recognized.
 */
export function getForumForCdnDomain(domain: string): string | undefined {
  return CDN_DOMAIN_MAP[domain]
}

/**
 * Given a full URL, extract the hostname and return the forum identity.
 */
export function getForumFromUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname
    return getForumForCdnDomain(hostname)
  } catch {
    return undefined
  }
}
