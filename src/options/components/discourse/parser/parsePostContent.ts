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

  console.log('[parsePostContent] Input length:', cooked.length)

  console.log(
    '[parsePostContent] Contains carousel grid?',
    cooked.includes('d-image-grid--carousel')
  )

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

  console.log(
    '[parsePostContent] After extraction - carousels:',
    ctx.carousels.length,
    'lightboxes:',
    ctx.lightboxes.length
  )

  const html = String(processor.stringify(tree))

  console.log(
    '[parsePostContent] HTML contains carousel markers:',
    html.includes('__DISCOURSE_CAROUSEL_')
  )

  const segments = buildSegments(html, ctx.lightboxes, ctx.carousels, ctx.imageGrids)

  const fullHtml = renderSegmentsToHtml(segments)
  const carouselSegments = segments.filter(s => s.type === 'carousel').length

  console.log('[parsePostContent] Carousel segments:', carouselSegments)

  return { html: fullHtml, images: ctx.images, segments, footnotes }
}
