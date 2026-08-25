import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import type { Root, Node } from 'hast'

import type { ParsedContent } from '../types'
import { unwrapDiscourseFaviconProxyUrl } from '../navigation'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import { rewriteEmojiUrlForCdn } from '../utils'

import { createParseContext } from './context'
import { extractCarousels } from './extractCarousels'
import { extractImageGrid } from './extractImageGrid'
import { extractLightboxWrappers } from './extractLightboxWrappers'
import { extractStandaloneImages } from './extractStandaloneImages'
import { extractFootnotes } from './extractFootnotes'
import { cleanupMediaNodes } from './cleanupMediaNodes'
import { buildSegments } from './buildSegments'
import { transformQuotes } from './transformQuotes'
import { renderSegmentsToHtml } from './renderSegmentsToHtml'

/**
 * 遍历整个 hast 树，先移除 Discourse favicon 代理层，再把站点表情 <img>
 * 的 src 改走 CDN（linux.do 特判）。帖子正文/引用/脚注中的图片都在这里统一处理。
 */
const rewriteImageSources = (node: unknown, baseUrl?: string): void => {
  if (!node || typeof node !== 'object') return
  const element = node as {
    tagName?: string
    properties?: { src?: unknown }
    children?: unknown[]
  }
  if (element.tagName === 'img' && typeof element.properties?.src === 'string') {
    const source = unwrapDiscourseFaviconProxyUrl(element.properties.src, baseUrl)
    element.properties.src = rewriteEmojiUrlForCdn(source)
  }
  if (Array.isArray(element.children)) {
    element.children.forEach(child => {
      if (child && typeof child === 'object') rewriteImageSources(child, baseUrl)
    })
  }
}

const PARSE_CACHE_LIMIT = 200
const parseCache = new Map<string, ParsedContent>()

export const parsePostContent = (cooked: string, baseUrl?: string): ParsedContent => {
  if (!cooked) return { html: '', images: [], segments: [] }

  // TopicView re-derives its parsed-post map whenever any post in the stream
  // changes (likes, message-bus patches). Parsing is a full rehype pass, so
  // memoize by (baseUrl, cooked); entries evicted LRU to bound memory.
  const cacheKey = `${baseUrl ?? ''}\u0000${cooked}`
  const cached = parseCache.get(cacheKey)
  if (cached) {
    parseCache.delete(cacheKey)
    parseCache.set(cacheKey, cached)
    return cached
  }

  const sanitizedCooked = sanitizeDiscourseHtml(cooked)

  const hasSpoiler =
    sanitizedCooked.includes('spoiled') || sanitizedCooked.includes('spoiler-blurred')
  if (__ENABLE_LOGGING__ && hasSpoiler) {
    console.log('[parsePostContent] Input contains spoiler:', sanitizedCooked.substring(0, 500))
  }

  const processor = unified().use(rehypeStringify)

  const ctx = createParseContext(baseUrl, (node: unknown) =>
    String(processor.stringify(node as Root))
  )

  const tree = unified().use(rehypeParse, { fragment: true }).parse(sanitizedCooked) as Root

  // Run before image extraction so rendered HTML, lightboxes, and image
  // collections all share the direct source URL.
  rewriteImageSources(tree, baseUrl)

  transformQuotes(tree as Node, ctx)

  const footnotes = extractFootnotes(tree, ctx)

  extractCarousels(tree, ctx)

  extractImageGrid(tree, ctx)

  extractLightboxWrappers(tree, ctx)

  extractStandaloneImages(tree, ctx)

  cleanupMediaNodes(tree)

  const html = String(processor.stringify(tree))

  if (__ENABLE_LOGGING__ && hasSpoiler) {
    console.log('[parsePostContent] Output HTML:', html.substring(0, 500))
    console.log('[parsePostContent] Lightboxes extracted:', ctx.lightboxes.length)
  }

  const segments = buildSegments(html, ctx.lightboxes, ctx.carousels, ctx.imageGrids)

  const fullHtml = renderSegmentsToHtml(segments)

  const result = { html: fullHtml, images: ctx.images, segments, footnotes }

  if (parseCache.size >= PARSE_CACHE_LIMIT) {
    const oldest = parseCache.keys().next().value
    if (oldest !== undefined) parseCache.delete(oldest)
  }
  parseCache.set(cacheKey, result)

  return result
}
