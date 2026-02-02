<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

import type { ParsedContent, LightboxImage } from '../types'
import { parsePostContent } from '../parser/parsePostContent'
import ImageProxy from '../ImageProxy.vue'

type ImageGridSegment = Extract<ParsedContent['segments'][number], { type: 'image-grid' }>

const props = defineProps<{
  segments: ParsedContent['segments']
  baseUrl: string
  footnotes?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'navigate', url: string): void
}>()

const getCarouselImg = (images: LightboxImage[], index: number) => {
  const image = images[index]
  return image?.thumbSrc || image?.href || ''
}

const getLightboxThumb = (image: LightboxImage) => {
  return image.thumbSrc || image.href
}

const getLightboxPreview = (image: LightboxImage) => {
  if (image.href && image.href !== getLightboxThumb(image)) {
    return { src: image.href }
  }
  return true
}

let activeFootnoteRoot: HTMLElement | null = null
let activeFootnoteContainer: HTMLDivElement | null = null
let scrollContainer: HTMLElement | null = null

const getImageGridItems = (segment: ImageGridSegment) => {
  if (segment.columns.length <= 1) return segment.columns[0] || []
  return segment.columns.flat()
}

const getImageGridColumnsCount = (segment: ImageGridSegment) => {
  if (segment.columnsCount) return Math.max(segment.columnsCount, 1)
  if (segment.columns.length > 1) return segment.columns.length
  return 2
}

const isSameSiteUrl = (url: string): boolean => {
  if (!url) return false
  try {
    const urlObj = new URL(url, props.baseUrl)
    const baseUrlObj = new URL(props.baseUrl)
    return urlObj.origin === baseUrlObj.origin
  } catch {
    return false
  }
}

const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // Handle spoiler click
  const spoiler = target?.closest('.spoiled') as HTMLElement | null
  if (spoiler) {
    const isBlurred =
      spoiler.classList.contains('spoiler-blurred') ||
      spoiler.getAttribute('data-spoiler-state') === 'blurred'
    if (isBlurred) {
      spoiler.classList.remove('spoiler-blurred')
      spoiler.setAttribute('data-spoiler-state', 'revealed')
      spoiler.setAttribute('aria-expanded', 'true')
      spoiler.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        el.setAttribute('aria-hidden', 'false')
      })
    } else {
      spoiler.classList.add('spoiler-blurred')
      spoiler.setAttribute('data-spoiler-state', 'blurred')
      spoiler.setAttribute('aria-expanded', 'false')
      spoiler.querySelectorAll('[aria-hidden="false"]').forEach(el => {
        el.setAttribute('aria-hidden', 'true')
      })
    }
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const anchor = target?.closest('a') as HTMLAnchorElement | null

  if (!anchor) return
  if (anchor.closest('sup.footnote-ref')) {
    event.preventDefault()
    return
  }

  const href = anchor.getAttribute('href')
  if (!href) return

  // Check if it's a same-site URL
  if (href.startsWith('/')) {
    // Internal path
    event.preventDefault()
    emit('navigate', href)
  } else if (href.startsWith('http') && isSameSiteUrl(href)) {
    // Same-site full URL, convert to internal path
    event.preventDefault()
    try {
      const urlObj = new URL(href)
      const internalPath = urlObj.pathname + urlObj.search + urlObj.hash
      emit('navigate', internalPath)
    } catch {
      // Invalid URL, let it open
      return
    }
  }
  // External links will open normally or in new tab
}

const updateFootnotePosition = () => {
  if (!activeFootnoteRoot || !activeFootnoteContainer || !contentRef.value) return
  const host = contentRef.value
  const rect = activeFootnoteRoot.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  const maxWidth = Math.min(520, Math.max(240, hostRect.width - 24))
  const left = Math.min(rect.left - hostRect.left, hostRect.width - maxWidth - 12)
  const top = rect.bottom - hostRect.top + 6
  activeFootnoteContainer.style.maxWidth = `${maxWidth}px`
  activeFootnoteContainer.style.left = `${Math.max(12, left)}px`
  activeFootnoteContainer.style.top = `${Math.max(8, top)}px`
}

const hideActiveFootnote = () => {
  if (activeFootnoteContainer) {
    activeFootnoteContainer.remove()
  }
  if (activeFootnoteRoot) {
    const trigger = activeFootnoteRoot.querySelector('sup.footnote-ref a')
    trigger?.setAttribute('aria-expanded', 'false')
  }
  activeFootnoteContainer = null
  activeFootnoteRoot = null
}

const showFootnoteFor = (footnoteRoot: HTMLElement, trigger: HTMLAnchorElement) => {
  if (activeFootnoteRoot === footnoteRoot) return
  hideActiveFootnote()

  const href = trigger.getAttribute('href') || ''
  const id = href.startsWith('#') ? href.slice(1) : href
  const rawContent = id ? props.footnotes?.[id] : undefined
  if (!rawContent) return

  const container = document.createElement('div')
  container.className = 'post-footnote-inline'
  const parsed = parsePostContent(rawContent, props.baseUrl)
  container.innerHTML = parsed.html
  container.addEventListener('mouseenter', () => {
    // keep visible while hovering the tooltip itself
  })
  container.addEventListener('mouseleave', () => {
    hideActiveFootnote()
  })

  const host = contentRef.value
  if (!host) return

  host.appendChild(container)
  trigger.setAttribute('aria-expanded', 'true')
  activeFootnoteRoot = footnoteRoot
  activeFootnoteContainer = container
  updateFootnotePosition()
}

const handleMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const footnoteRoot = target?.closest('sup.footnote-ref') as HTMLElement | null
  if (!footnoteRoot) return
  const trigger = footnoteRoot.querySelector('a') as HTMLAnchorElement | null
  if (!trigger) return
  showFootnoteFor(footnoteRoot, trigger)
}

const handleMouseOut = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const footnoteRoot = target?.closest('sup.footnote-ref') as HTMLElement | null
  if (!footnoteRoot) return
  if (
    event.relatedTarget instanceof Node &&
    (footnoteRoot.contains(event.relatedTarget) ||
      activeFootnoteContainer?.contains(event.relatedTarget))
  ) {
    return
  }
  hideActiveFootnote()
}

const mounted = ref(false)
const contentRef = ref<HTMLElement | null>(null)

onMounted(() => {
  mounted.value = true
  // Add click event listener to the content div
  nextTick(() => {
    const contentDiv = contentRef.value
    if (contentDiv) {
      contentDiv.addEventListener('click', handleClick)
      contentDiv.addEventListener('mouseover', handleMouseOver)
      contentDiv.addEventListener('mouseout', handleMouseOut)
      scrollContainer = contentDiv.closest('.content-area') as HTMLElement | null
      scrollContainer?.addEventListener('scroll', updateFootnotePosition, { passive: true })
    }
  })
  window.addEventListener('resize', updateFootnotePosition, { passive: true })
})

// Process HTML content to replace img-proxy tags with img tags that will be handled via DOM manipulation
const processHtmlContent = (html: string): string => {
  // Replace img-proxy tags with regular img tags but with custom data attributes
  return html.replace(/<img-proxy\s+([^>]+)>/g, (match, attrs) => {
    // Parse attributes
    const originalSrcMatch = attrs.match(/original-src="([^"]*)"/)
    const fallbackSrcMatch = attrs.match(/fallback-src="([^"]*)"/)
    const altMatch = attrs.match(/alt="([^"]*)"/)
    const loadingMatch = attrs.match(/loading="([^"]*)"/)
    const widthMatch = attrs.match(/width="([^"]*)"/)
    const heightMatch = attrs.match(/height="([^"]*)"/)
    const srcsetMatch = attrs.match(/srcset="([^"]*)"/)
    const styleMatch = attrs.match(/style="([^"]*)"/)

    const originalSrc = originalSrcMatch ? originalSrcMatch[1] : ''
    const fallbackSrc = fallbackSrcMatch ? fallbackSrcMatch[1] : originalSrc
    const alt = altMatch ? altMatch[1] : ''
    const loading = loadingMatch ? loadingMatch[1] : ''
    const width = widthMatch ? widthMatch[1] : ''
    const height = heightMatch ? heightMatch[1] : ''
    const srcset = srcsetMatch ? srcsetMatch[1] : ''
    const style = styleMatch ? styleMatch[1] : ''

    // Create an img tag with data attributes for later processing
    let imgTag = `<img data-original-src="${originalSrc}" data-force-proxy="true" alt="${alt}" `
    if (width) imgTag += `width="${width}" `
    if (height) imgTag += `height="${height}" `
    if (srcset) imgTag += `srcset="${srcset}" `
    if (loading) imgTag += `loading="${loading}" `
    if (style) imgTag += `style="${style}" `
    imgTag += `class="proxy-image" />`

    return imgTag
  })
}

// Function to replace proxy images with actual images loaded through pageFetch
const replaceProxyImages = async () => {
  const contentDiv = contentRef.value
  if (!contentDiv) return

  const proxyImages = contentDiv.querySelectorAll('img.proxy-image[data-original-src]')

  for (const img of Array.from(proxyImages)) {
    const originalSrc = img.getAttribute('data-original-src') || ''
    const forceProxy = img.getAttribute('data-force-proxy') === 'true'
    const fallbackSrc = img.getAttribute('data-original-src') || '' // Use original as fallback too
    const alt = img.getAttribute('alt') || ''
    const width = img.getAttribute('width')
    const height = img.getAttribute('height')
    const srcset = img.getAttribute('srcset')
    const loading = img.getAttribute('loading')
    const style = img.getAttribute('style')

    try {
      // Import pageFetch dynamically
      const { pageFetch } = await import('../utils')

      // If forceProxy is true, always use the proxy
      if (forceProxy) {
        // Force through proxy
        const response = await pageFetch<Blob>(originalSrc, {}, 'blob')

        if (response.ok && response.data) {
          const blob = response.data as unknown as Blob
          const url = URL.createObjectURL(blob)

          // Set the src to the blob URL
          img.setAttribute('src', url)

          // Clean up the object URL when the image is no longer needed
          img.addEventListener(
            'load',
            () => {
              URL.revokeObjectURL(url)
            },
            { once: true }
          )
        } else {
          // Fallback to original URL if proxy fails
          img.setAttribute('src', fallbackSrc)
        }
      } else {
        // Fetch the image through the proxy
        const response = await pageFetch<Blob>(originalSrc, {}, 'blob')

        if (response.ok && response.data) {
          const blob = response.data as unknown as Blob
          const url = URL.createObjectURL(blob)

          // Set the src to the blob URL
          img.setAttribute('src', url)

          // Clean up the object URL when the image is no longer needed
          img.addEventListener(
            'load',
            () => {
              URL.revokeObjectURL(url)
            },
            { once: true }
          )
        } else {
          // Fallback to original URL if proxy fails
          img.setAttribute('src', fallbackSrc)
        }
      }
    } catch (error) {
      // If proxy fails, fallback to original URL
      img.setAttribute('src', fallbackSrc)
      console.warn(`Failed to load image through proxy: ${originalSrc}`, error)
    }
  }
}

onMounted(() => {
  mounted.value = true
  // Add click event listener to the content div
  nextTick(() => {
    const contentDiv = contentRef.value
    if (contentDiv) {
      contentDiv.addEventListener('click', handleClick)
      contentDiv.addEventListener('mouseover', handleMouseOver)
      contentDiv.addEventListener('mouseout', handleMouseOut)
      scrollContainer = contentDiv.closest('.content-area') as HTMLElement | null
      scrollContainer?.addEventListener('scroll', updateFootnotePosition, { passive: true })

      // Process proxy images after content is rendered
      setTimeout(replaceProxyImages, 100)
    }
  })
  window.addEventListener('resize', updateFootnotePosition, { passive: true })
})

onUnmounted(() => {
  const contentDiv = contentRef.value
  if (contentDiv) {
    contentDiv.removeEventListener('click', handleClick)
    contentDiv.removeEventListener('mouseover', handleMouseOver)
    contentDiv.removeEventListener('mouseout', handleMouseOut)
    scrollContainer?.removeEventListener('scroll', updateFootnotePosition)
  }
  scrollContainer = null
  window.removeEventListener('resize', updateFootnotePosition)
  hideActiveFootnote()
})
</script>

<template>
  <div ref="contentRef" class="post-content prose dark:prose-invert max-w-none text-sm">
    <template v-for="(segment, idx) in props.segments" :key="idx">
      <div
        v-if="segment.type === 'html'"
        class="post-content-fragment"
        v-html="processHtmlContent(segment.html)"
      />
      <div v-else-if="segment.type === 'carousel'" class="post-carousel">
        <div class="post-carousel-track">
          <div
            v-for="(img, imgIndex) in segment.images"
            :key="imgIndex"
            class="post-carousel-slide"
          >
            <ImageProxy
              class="post-carousel-image"
              :original-src="getLightboxThumb(img)"
              :alt="img.alt || ''"
              :width="img.width"
              :height="img.height"
              :srcset="img.srcset"
              :loading="img.loading || 'lazy'"
              :style="img.style"
              :fallback-src="getLightboxThumb(img)"
              :force-proxy="true"
            />
          </div>
        </div>
        <div class="post-carousel-thumbs">
          <ImageProxy
            v-for="(img, imgIndex) in segment.images"
            :key="`thumb-${imgIndex}`"
            class="post-carousel-thumb"
            :original-src="getCarouselImg(segment.images, imgIndex)"
            :alt="img.alt || ''"
            loading="lazy"
            :fallback-src="getCarouselImg(segment.images, imgIndex)"
            :force-proxy="true"
          />
        </div>
      </div>
      <div
        v-else-if="segment.type === 'image-grid'"
        class="post-image-grid"
        :style="{ '--grid-columns': getImageGridColumnsCount(segment) }"
      >
        <div
          v-for="(img, imgIndex) in getImageGridItems(segment)"
          :key="imgIndex"
          class="post-image-grid-item"
        >
          <ImageProxy
            class="post-image-grid-image"
            :original-src="getLightboxThumb(img)"
            :alt="img.alt || ''"
            :width="img.width"
            :height="img.height"
            :srcset="img.srcset"
            :loading="img.loading || 'lazy'"
            :style="img.style"
            :fallback-src="getLightboxThumb(img)"
            :force-proxy="true"
          />
        </div>
      </div>
      <a-image
        v-else
        class="post-inline-image rounded"
        wrapper-class-name="post-inline-image-wrapper"
        :src="getLightboxThumb(segment.image)"
        :preview="getLightboxPreview(segment.image)"
        :alt="segment.image.alt || ''"
        :width="segment.image.width"
        :height="segment.image.height"
        :srcset="segment.image.srcset"
        :style="segment.image.style"
      />
    </template>
  </div>
</template>

<style scoped src="../css/PostContent.css"></style>
