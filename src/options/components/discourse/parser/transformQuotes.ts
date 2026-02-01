import type { Element, Node, Parent, Properties } from 'hast'

import { buildLightbox, ParseContext, resolveUrl } from './context'
import {
  findAll,
  findFirst,
  getClassList,
  getPropString,
  hasClass,
  isElement,
  isParent
} from './astUtils'
import { traverse } from './traverse'

const isCarouselContainer = (node: Element) => {
  if (hasClass(node, 'd-image-grid--carousel')) return true
  if (getPropString(node, 'data-mode') === 'carousel') return true
  const carousel = findFirst(node, el => hasClass(el, 'd-image-carousel'))
  return !!carousel
}

const isImageGrid = (node: Element) => {
  if (!hasClass(node, 'd-image-grid')) return false
  if (hasClass(node, 'd-image-grid--carousel')) return false
  if (getPropString(node, 'data-mode') === 'carousel') return false
  const hasCarousel = findFirst(node, el => hasClass(el, 'd-image-carousel'))
  if (hasCarousel) return false
  return true
}

const isInsideOnebox = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'onebox'))
}

const isEmojiOrAvatar = (node: Element) => {
  const classList = getClassList(node)
  const src = getPropString(node, 'src') || ''
  if (src.includes('/images/emoji/')) return true
  if (classList.includes('emoji')) return true
  if (classList.includes('avatar')) return true
  if (classList.includes('site-icon')) return true
  return false
}

const createElement = (
  tagName: string,
  properties: Properties = {},
  children: Node[] = []
): Element => {
  return {
    type: 'element',
    tagName,
    properties,
    children
  }
}

const createImageElement = (image: ReturnType<typeof buildLightbox>, className: string) => {
  if (!image) return null
  const properties: Properties = {
    className,
    src: image.thumbSrc || image.href,
    alt: image.alt || '',
    loading: image.loading || 'lazy'
  }
  if (image.width) properties.width = image.width
  if (image.height) properties.height = image.height
  if (image.srcset) properties.srcset = image.srcset
  if (image.style) properties.style = image.style
  return createElement('img', properties)
}

const buildLightboxFromContainer = (container: Element, ctx: ParseContext) => {
  const anchor = findFirst(container, el => el.tagName === 'a' && hasClass(el, 'lightbox'))
  const img = findFirst(container, el => el.tagName === 'img')
  return buildLightbox(ctx, {
    href: anchor ? getPropString(anchor, 'href') : img ? getPropString(img, 'src') : undefined,
    downloadHref: anchor ? getPropString(anchor, 'data-download-href') : undefined,
    title: anchor ? getPropString(anchor, 'title') : undefined,
    thumbSrc: img ? getPropString(img, 'src') : undefined,
    alt: img ? getPropString(img, 'alt') : undefined,
    width: img ? getPropString(img, 'width') : undefined,
    height: img ? getPropString(img, 'height') : undefined,
    srcset: img ? getPropString(img, 'srcset') : undefined,
    dominantColor: img ? getPropString(img, 'data-dominant-color') : undefined,
    loading: img ? getPropString(img, 'loading') : undefined,
    style: img ? getPropString(img, 'style') : undefined
  })
}

const buildImageGridElement = (node: Element, ctx: ParseContext) => {
  let columnsCount = Number(getPropString(node, 'data-columns')) || undefined

  const columns = Array.from(node.children).filter(
    (child): child is Element => isElement(child) && hasClass(child, 'd-image-grid-column')
  )

  const collectWrappers = (target: Element) =>
    Array.from(target.children).filter(
      (child): child is Element => isElement(child) && hasClass(child, 'lightbox-wrapper')
    )

  const buildItems = (wrappers: Element[]) =>
    wrappers
      .map(wrapper => buildLightboxFromContainer(wrapper, ctx))
      .filter(Boolean) as NonNullable<ReturnType<typeof buildLightboxFromContainer>>[]

  let items: NonNullable<ReturnType<typeof buildLightboxFromContainer>>[] = []
  if (columns.length > 0) {
    const columnItems = columns.map(col => buildItems(collectWrappers(col))).filter(Boolean)
    items = columnItems.flat()
    if (!columnsCount && columnItems.length > 1) columnsCount = columnItems.length
  } else {
    items = buildItems(collectWrappers(node))
  }

  if (items.length === 0) return null
  const count = columnsCount || 2
  const grid = createElement('div', {
    className: 'post-image-grid',
    style: `--grid-columns: ${count};`
  })

  grid.children = items
    .map(img => {
      const imageEl = createImageElement(img, 'post-image-grid-image')
      if (!imageEl) return null
      return createElement('div', { className: 'post-image-grid-item' }, [imageEl])
    })
    .filter(Boolean) as Element[]

  return grid
}

const buildCarouselElement = (node: Element, ctx: ParseContext) => {
  const slides = findAll(node, el => hasClass(el, 'd-image-carousel__slide'))

  const buildItems = (containers: Element[]) =>
    containers
      .map(container => buildLightboxFromContainer(container, ctx))
      .filter(Boolean) as NonNullable<ReturnType<typeof buildLightboxFromContainer>>[]

  let items = buildItems(slides)
  if (items.length === 0) {
    const wrappers = findAll(node, el => hasClass(el, 'lightbox-wrapper'))
    items = buildItems(wrappers)
  }
  if (items.length === 0) return null

  const track = createElement('div', { className: 'post-carousel-track' })
  track.children = items
    .map(item => createImageElement(item, 'post-carousel-image'))
    .filter(Boolean) as Element[]

  const thumbs = createElement('div', { className: 'post-carousel-thumbs' })
  thumbs.children = items
    .map(item => createImageElement({ ...item, style: undefined }, 'post-carousel-thumb'))
    .filter(Boolean) as Element[]

  return createElement('div', { className: 'post-carousel' }, [track, thumbs])
}

const transformMediaInContainer = (root: Parent, ctx: ParseContext, ancestors: Element[]) => {
  for (let i = 0; i < root.children.length; ) {
    const child = root.children[i] as Node
    if (isElement(child)) {
      if (isInsideOnebox(ancestors)) {
        i += 1
        continue
      }

      if (isCarouselContainer(child)) {
        const carousel = buildCarouselElement(child, ctx)
        if (carousel) {
          root.children.splice(i, 1, carousel)
          i += 1
          continue
        }
      }

      if (isImageGrid(child)) {
        const grid = buildImageGridElement(child, ctx)
        if (grid) {
          root.children.splice(i, 1, grid)
          i += 1
          continue
        }
      }

      if (hasClass(child, 'lightbox-wrapper')) {
        const lightbox = buildLightboxFromContainer(child, ctx)
        const imageEl = createImageElement(lightbox, 'post-inline-image rounded')
        if (imageEl) {
          root.children.splice(i, 1, imageEl)
          i += 1
          continue
        }
      }

      if (child.tagName === 'img' && !isEmojiOrAvatar(child)) {
        const lightbox = buildLightbox(ctx, {
          href: getPropString(child, 'src'),
          thumbSrc: getPropString(child, 'src'),
          alt: getPropString(child, 'alt'),
          width: getPropString(child, 'width'),
          height: getPropString(child, 'height'),
          srcset: getPropString(child, 'srcset'),
          dominantColor: getPropString(child, 'data-dominant-color'),
          loading: getPropString(child, 'loading'),
          style: getPropString(child, 'style')
        })
        const imageEl = createImageElement(lightbox, 'post-inline-image rounded')
        if (imageEl) {
          root.children.splice(i, 1, imageEl)
          i += 1
          continue
        }
      }
    }

    if (isParent(child)) {
      const nextAncestors = isElement(child) ? [...ancestors, child] : ancestors
      transformMediaInContainer(child, ctx, nextAncestors)
    }
    i += 1
  }
}

// Convert full URL to internal path if it's same-site
const toInternalUrl = (ctx: ParseContext, url?: string | null): string | null => {
  if (!url) return null
  if (!ctx.baseUrl) return url

  try {
    // Parse the URL
    const urlObj = new URL(url)
    const baseUrlObj = new URL(ctx.baseUrl)

    // If same origin, return pathname
    if (urlObj.origin === baseUrlObj.origin) {
      return urlObj.pathname + urlObj.search + urlObj.hash
    }

    // Different origin, return original URL
    return url
  } catch {
    // Invalid URL, return as-is
    return url
  }
}

export const transformQuotes = (root: Node, ctx: ParseContext) => {
  traverse(root, (node, _parent, _index, ancestors) => {
    if (!isElement(node)) return
    if (!hasClass(node, 'quote')) return

    const title = findFirst(node, el => hasClass(el, 'title'))
    if (title) {
      const anchors = findAll(title, el => el.tagName === 'a')
      anchors.forEach(anchor => {
        const href = getPropString(anchor, 'href')
        if (!href) return

        // Convert to internal URL if same-site
        const internalUrl = toInternalUrl(ctx, href)
        if (internalUrl !== null && internalUrl !== href) {
          anchor.properties = {
            ...(anchor.properties || {}),
            href: internalUrl
          }
        }
      })

      const avatars = findAll(title, el => el.tagName === 'img' && hasClass(el, 'avatar'))
      avatars.forEach(img => {
        const src = getPropString(img, 'src')
        if (!src) return
        const full = resolveUrl(ctx, src)
        if (full.includes('/user_avatar/')) {
          const gifUrl = full.replace(/\.(png|jpg|jpeg|webp)(\?.*)?$/i, '.gif$2')
          img.properties = {
            ...(img.properties || {}),
            src: gifUrl
          }
        } else if (!src.startsWith('http')) {
          img.properties = {
            ...(img.properties || {}),
            src: full
          }
        }
      })
    }

    const blockquotes = findAll(node, el => el.tagName === 'blockquote')
    for (const block of blockquotes) {
      if (isParent(block)) {
        transformMediaInContainer(block, ctx, [...ancestors, node, block])
      }
    }

    return false
  })
}
