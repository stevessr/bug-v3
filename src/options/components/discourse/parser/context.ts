import type { LightboxImage } from '../types'

export interface ParseContext {
  baseUrl?: string
  images: string[]
  lightboxes: LightboxImage[]
  carousels: LightboxImage[][]
  imageGrids: LightboxImage[][][]
  seen: Set<string>
  stringify: (node: unknown) => string
}

export const createParseContext = (
  baseUrl: string | undefined,
  stringify: (node: unknown) => string
): ParseContext => {
  return {
    baseUrl,
    images: [],
    lightboxes: [],
    carousels: [],
    imageGrids: [],
    seen: new Set<string>(),
    stringify
  }
}

export const resolveUrl = (ctx: ParseContext, url?: string | null) => {
  if (!url) return ''
  return url.startsWith('http') ? url : ctx.baseUrl ? `${ctx.baseUrl}${url}` : url
}

export const addImage = (ctx: ParseContext, url?: string | null) => {
  const fullUrl = resolveUrl(ctx, url)
  if (!fullUrl) return ''
  if (!ctx.seen.has(fullUrl)) {
    ctx.seen.add(fullUrl)
    ctx.images.push(fullUrl)
  }
  return fullUrl
}

export const buildLightbox = (
  ctx: ParseContext,
  options: Partial<LightboxImage> & { href?: string | null; thumbSrc?: string | null }
): LightboxImage | null => {
  const href = resolveUrl(ctx, options.href)
  if (!href) return null
  const thumbSrc = resolveUrl(ctx, options.thumbSrc) || href
  addImage(ctx, href)
  return {
    href,
    downloadHref: options.downloadHref ? resolveUrl(ctx, options.downloadHref) : options.downloadHref,
    title: options.title,
    thumbSrc,
    alt: options.alt,
    base62Sha1: options.base62Sha1,
    width: options.width,
    height: options.height,
    srcset: options.srcset,
    dominantColor: options.dominantColor,
    loading: options.loading,
    style: options.style,
    metaHtml: options.metaHtml
  }
}
