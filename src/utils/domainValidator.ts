/**
 * Utility functions for validating emoji URLs against domain patterns
 */

/**
 * Extract hostname from a URL string
 * @param url The URL to parse
 * @returns The hostname or null if invalid
 */
function extractHostname(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Check if a hostname matches a domain pattern
 * Supports wildcards like *.example.com
 * @param hostname The hostname to check
 * @param domainPattern The domain pattern (can include wildcards)
 * @returns True if the hostname matches the pattern
 */
function matchesDomainPattern(hostname: string, domainPattern: string): boolean {
  const pattern = domainPattern.toLowerCase()
  const host = hostname.toLowerCase()

  // Exact match
  if (host === pattern) {
    return true
  }

  // Wildcard pattern (*.example.com)
  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.slice(2) // Remove "*."
    // Match if hostname is exactly the base domain or ends with .baseDomain
    return host === baseDomain || host.endsWith('.' + baseDomain)
  }

  // No wildcard but check if hostname is a subdomain of the pattern
  if (host.endsWith('.' + pattern)) {
    return true
  }

  return false
}

/**
 * Get the current domain from window.location
 * Returns null if window is not available (e.g., in service worker)
 * @returns The current domain or null
 */
export function getCurrentDomain(): string | null {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname.toLowerCase()
  }
  return null
}

/**
 * Check if an emoji URL belongs to the specified domain pattern
 * @param emojiUrl The emoji image URL to check
 * @param domainPattern The domain pattern to match against (e.g., "linux.do" or "*.linux.do")
 * @returns True if the URL matches the domain pattern
 */
export function isEmojiFromDomain(emojiUrl: string, domainPattern: string): boolean {
  const hostname = extractHostname(emojiUrl)
  if (!hostname) {
    return false
  }

  return matchesDomainPattern(hostname, domainPattern)
}

/**
 * Filter emojis by domain pattern
 * @param emojis Array of emojis to filter
 * @param domainPattern Domain pattern to match (e.g., "linux.do" or "*.linux.do")
 * @returns Filtered array of emojis that match the domain
 */
export function filterEmojisByDomain<T extends { url: string }>(
  emojis: T[],
  domainPattern: string
): T[] {
  if (!domainPattern) {
    return emojis
  }

  return emojis.filter(emoji => isEmojiFromDomain(emoji.url, domainPattern))
}

/**
 * Check if we should apply domain filtering based on current location
 * Returns null if no filtering should be applied, or the domain pattern to use
 * @returns Domain pattern to use for filtering, or null to disable filtering
 */
export function getDomainFilterPattern(): string | null {
  const currentDomain = getCurrentDomain()
  if (!currentDomain) {
    return null
  }

  // Apply filtering for linux.do and its subdomains
  if (currentDomain === 'linux.do' || currentDomain.endsWith('.linux.do')) {
    return '*.linux.do'
  }

  // Add more domain-specific filters here if needed
  // For example:
  // if (currentDomain === 'example.com' || currentDomain.endsWith('.example.com')) {
  //   return '*.example.com'
  // }

  // By default, no filtering
  return null
}
