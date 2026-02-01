<script setup lang="ts">
import type { ParsedContent, LightboxImage } from '../types'

type ImageGridSegment = Extract<ParsedContent['segments'][number], { type: 'image-grid' }>

const props = defineProps<{
  segments: ParsedContent['segments']
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
