import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import type { Root } from 'hast'

import type { ParsedContent } from '../types'

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

export const parsePostContent = (cooked: string, baseUrl?: string): ParsedContent => {
  if (!cooked) return { html: '', images: [], segments: [] }

  const hasSpoiler = cooked.includes('spoiled') || cooked.includes('spoiler-blurred')
  if (hasSpoiler) {
    console.log('[parsePostContent] Input contains spoiler:', cooked.substring(0, 500))
  }

  const processor = unified().use(rehypeStringify)

  const ctx = createParseContext(baseUrl, (node: unknown) =>
    String(processor.stringify(node as Root))
  )

  const tree = unified().use(rehypeParse, { fragment: true }).parse(cooked) as Root

  transformQuotes(tree, ctx)

  const footnotes = extractFootnotes(tree, ctx)

  extractCarousels(tree, ctx)

  extractImageGrid(tree, ctx)

  extractLightboxWrappers(tree, ctx)

  extractStandaloneImages(tree, ctx)

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
