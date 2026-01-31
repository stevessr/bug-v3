import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import type { Root } from 'hast'

import type { ParsedContent } from '../types'

import { createParseContext } from './context'
import { extractCarousels } from './extractCarousels'
import { extractLightboxWrappers } from './extractLightboxWrappers'
import { extractStandaloneImages } from './extractStandaloneImages'
import { cleanupMediaNodes } from './cleanupMediaNodes'
import { buildSegments } from './buildSegments'

export const parsePostContent = (cooked: string, baseUrl?: string): ParsedContent => {
  if (!cooked) return { html: '', images: [], segments: [] }

  const processor = unified().use(rehypeStringify)
  const ctx = createParseContext(baseUrl, (node: unknown) =>
    String(processor.stringify(node as Root))
  )

  const tree = unified().use(rehypeParse, { fragment: true }).parse(cooked) as Root

  extractCarousels(tree, ctx)
  extractLightboxWrappers(tree, ctx)
  extractStandaloneImages(tree, ctx)
  cleanupMediaNodes(tree)

  const html = String(processor.stringify(tree))
  const segments = buildSegments(html, ctx.lightboxes, ctx.carousels)

  const cleanedHtml = segments
    .filter(segment => segment.type === 'html')
    .map(segment => segment.html)
    .join('')

  return { html: cleanedHtml, images: ctx.images, segments }
}
