import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import type { Root, Node } from 'hast'

import type { ParsedContent } from '../types'
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
 * 遍历整个 hast 树，把站点表情 <img> 的 src 改走 CDN（linux.do 特判）。
 * 帖子正文/引用/脚注中的表情图片都在这里统一处理。
 */
const rewriteEmojiImageSources = (node: unknown): void => {
  if (!node || typeof node !== 'object') return
  const element = node as {
    tagName?: string
    properties?: { src?: unknown }
    children?: unknown[]
  }
  if (element.tagName === 'img' && typeof element.properties?.src === 'string') {
    element.properties.src = rewriteEmojiUrlForCdn(element.properties.src)
  }
  if (Array.isArray(element.children)) {
    element.children.forEach(child => {
      if (child && typeof child === 'object') rewriteEmojiImageSources(child)
    })
  }
}

export const parsePostContent = (cooked: string, baseUrl?: string): ParsedContent => {
  if (!cooked) return { html: '', images: [], segments: [] }

  const sanitizedCooked = sanitizeDiscourseHtml(cooked)

  const hasSpoiler =
    sanitizedCooked.includes('spoiled') || sanitizedCooked.includes('spoiler-blurred')
  if (hasSpoiler) {
    console.log('[parsePostContent] Input contains spoiler:', sanitizedCooked.substring(0, 500))
  }

  const processor = unified().use(rehypeStringify)

  const ctx = createParseContext(baseUrl, (node: unknown) =>
    String(processor.stringify(node as Root))
  )

  const tree = unified().use(rehypeParse, { fragment: true }).parse(sanitizedCooked) as Root

  transformQuotes(tree as Node, ctx)

  const footnotes = extractFootnotes(tree, ctx)

  extractCarousels(tree, ctx)

  extractImageGrid(tree, ctx)

  extractLightboxWrappers(tree, ctx)

  extractStandaloneImages(tree, ctx)

  rewriteEmojiImageSources(tree)

  cleanupMediaNodes(tree)

  const html = String(processor.stringify(tree))

  if (hasSpoiler) {
    console.log('[parsePostContent] Output HTML:', html.substring(0, 500))
    console.log('[parsePostContent] Lightboxes extracted:', ctx.lightboxes.length)
  }

  const segments = buildSegments(html, ctx.lightboxes, ctx.carousels, ctx.imageGrids)

  const fullHtml = renderSegmentsToHtml(segments)

  return { html: fullHtml, images: ctx.images, segments, footnotes }
}
