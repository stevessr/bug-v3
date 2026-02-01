<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

import type { ParsedContent, LightboxImage } from '../types'

type ImageGridSegment = Extract<ParsedContent['segments'][number], { type: 'image-grid' }>

const props = defineProps<{
  segments: ParsedContent['segments']
  baseUrl: string
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
  const anchor = target.closest('a') as HTMLAnchorElement | null

  if (!anchor) return

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

const mounted = ref(false)

onMounted(() => {
  mounted.value = true
  // Add click event listener to the content div
  nextTick(() => {
    const contentDiv = document.querySelector('.post-content') as HTMLElement
    if (contentDiv) {
      contentDiv.addEventListener('click', handleClick)
    }
  })
})

onUnmounted(() => {
  const contentDiv = document.querySelector('.post-content') as HTMLElement
  if (contentDiv) {
    contentDiv.removeEventListener('click', handleClick)
  }
})
</script>

<template>
  <div class="post-content prose dark:prose-invert max-w-none text-sm">
    <template v-for="(segment, idx) in props.segments" :key="idx">
      <div v-if="segment.type === 'html'" class="post-content-fragment" v-html="segment.html" />
      <div v-else-if="segment.type === 'carousel'" class="post-carousel">
        <div class="post-carousel-track">
          <div
            v-for="(img, imgIndex) in segment.images"
            :key="imgIndex"
            class="post-carousel-slide"
          >
            <img
              class="post-carousel-image"
              :src="getLightboxThumb(img)"
              :alt="img.alt || ''"
              :width="img.width"
              :height="img.height"
              :srcset="img.srcset"
              :data-base62-sha1="img.base62Sha1"
              :data-dominant-color="img.dominantColor"
              :loading="img.loading || 'lazy'"
              :style="img.style"
            />
          </div>
        </div>
        <div class="post-carousel-thumbs">
          <img
            v-for="(img, imgIndex) in segment.images"
            :key="`thumb-${imgIndex}`"
            class="post-carousel-thumb"
            :src="getCarouselImg(segment.images, imgIndex)"
            :alt="img.alt || ''"
            loading="lazy"
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
          <img
            class="post-image-grid-image"
            :src="getLightboxThumb(img)"
            :alt="img.alt || ''"
            :width="img.width"
            :height="img.height"
            :srcset="img.srcset"
            :data-base62-sha1="img.base62Sha1"
            :data-dominant-color="img.dominantColor"
            :loading="img.loading || 'lazy'"
            :style="img.style"
          />
        </div>
      </div>
      <img
        v-else
        class="post-inline-image rounded"
        :src="getLightboxThumb(segment.image)"
        :alt="segment.image.alt || ''"
        :data-base62-sha1="segment.image.base62Sha1"
        :data-dominant-color="segment.image.dominantColor"
        :loading="segment.image.loading || 'lazy'"
        :style="segment.image.style"
      />
    </template>
  </div>
</template>

<style scoped src="../css/PostContent.css"></style>
