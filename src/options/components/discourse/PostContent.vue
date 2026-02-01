<script setup lang="ts">
import type { ParsedContent, LightboxImage } from './types'

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
    <a-image-preview-group>
      <template v-for="(segment, idx) in props.segments" :key="idx">
        <div v-if="segment.type === 'html'" class="post-content-fragment" v-html="segment.html" />
        <a-carousel
          v-else-if="segment.type === 'carousel'"
          class="post-carousel"
          arrows
          dots-class="slick-dots slick-thumb"
        >
          <template #customPaging="{ i }">
            <a class="post-carousel-thumb">
              <img :src="getCarouselImg(segment.images, i)" />
            </a>
          </template>
          <div
            v-for="(img, imgIndex) in segment.images"
            :key="imgIndex"
            class="post-carousel-slide"
          >
            <a-image
              class="post-carousel-image"
              :src="getLightboxThumb(img)"
              :preview="{ src: img.href }"
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
        </a-carousel>
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
        <a-image
          v-else
          :src="getLightboxThumb(segment.image)"
          :preview="{ src: segment.image.href }"
          :alt="segment.image.alt || ''"
          :data-base62-sha1="segment.image.base62Sha1"
          :data-dominant-color="segment.image.dominantColor"
          :loading="segment.image.loading || 'lazy'"
          :style="segment.image.style"
          :fallback="'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4='"
          class="post-inline-image rounded cursor-pointer"
        />
      </template>
    </a-image-preview-group>
  </div>
</template>

<style scoped src="./PostContent.css"></style>
