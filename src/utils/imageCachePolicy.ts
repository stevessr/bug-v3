import type { AppSettings } from '@/types/type'

export type ImageCacheStrategy = 'auto' | 'force-indexeddb' | 'force-source' | 'adaptive'

const DOMAIN_BLOCK_MS = 10 * 60 * 1000
const domainBlocklist = new Map<string, number>()

const normalizeDomain = (input: string) => {
  try {
    const url = input.includes('://') ? new URL(input) : new URL(`https://${input}`)
    return url.hostname
  } catch {
    return ''
  }
}

export const resolveImageCacheStrategy = (settings: AppSettings): ImageCacheStrategy => {
  if (settings.imageCacheStrategy) return settings.imageCacheStrategy
  // Legacy fallback
  if (settings.useIndexedDBForImages === false) return 'force-source'
  return 'auto'
}

export const shouldUseImageCache = (settings: AppSettings): boolean => {
  return resolveImageCacheStrategy(settings) !== 'force-source'
}

export const markImageDomainBlocked = (input: string, ttlMs: number = DOMAIN_BLOCK_MS) => {
  const domain = normalizeDomain(input)
  if (!domain) return
  domainBlocklist.set(domain, Date.now() + ttlMs)
}

export const isImageDomainBlocked = (input: string): boolean => {
  const domain = normalizeDomain(input)
  if (!domain) return false
  const until = domainBlocklist.get(domain)
  if (!until) return false
  if (Date.now() > until) {
    domainBlocklist.delete(domain)
    return false
  }
  return true
}

export const shouldPreferCache = (settings: AppSettings, url?: string): boolean => {
  const strategy = resolveImageCacheStrategy(settings)
  if (strategy === 'force-indexeddb') return true
  if (strategy === 'adaptive' && url && isImageDomainBlocked(url)) return true
  return false
}
