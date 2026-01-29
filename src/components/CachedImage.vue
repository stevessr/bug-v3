<script setup lang="ts">
/**
 * CachedImage 组件
 * 自动使用 IndexedDB 缓存的图片，如果缓存可用则使用 blob URL
 * 当启用 IndexedDB 缓存时，强制使用缓存，失败则显示 404 占位图
 */
import { ref, watch, onMounted } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'

const props = defineProps<{
  src: string
  alt?: string
  class?: string
  title?: string
  loading?: 'lazy' | 'eager'
}>()

const emojiStore = useEmojiStore()
const displaySrc = ref(props.src)
const isCached = ref(false)
const isError = ref(false)

// 404 占位图 - 使用 data URI 避免额外请求
const ERROR_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23f0f0f0"/%3E%3Ctext x="32" y="36" text-anchor="middle" fill="%23999" font-size="12"%3E404%3C/text%3E%3C/svg%3E'

const isExtensionPage = () =>
  typeof window !== 'undefined' &&
  (window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'moz-extension:' ||
    window.location.protocol === 'safari-extension:')

const shouldUseCache = (url: string) => {
  if (!url) return false
  if (emojiStore.settings.useIndexedDBForImages) return true
  // Extension pages can't embed some cross-origin images due to CORP.
  return isExtensionPage() && (url.startsWith('http://') || url.startsWith('https://'))
}

// 是否强制使用缓存（启用 IndexedDB 缓存时，失败不回退到原始 URL）
const isForceCache = () => !!emojiStore.settings.useIndexedDBForImages

// 异步获取缓存的图片 URL
const loadCachedImage = async (url: string) => {
  if (!url) {
    displaySrc.value = url
    return
  }

  // 对于 blob: 和 data: URL，直接使用
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    displaySrc.value = url
    return
  }

  if (!shouldUseCache(url)) {
    displaySrc.value = url
    return
  }

  try {
    const { getCachedImage, cacheImage } = await import('@/utils/imageCache')

    // 先尝试从缓存获取
    const cachedUrl = await getCachedImage(url)
    if (cachedUrl) {
      displaySrc.value = cachedUrl
      isCached.value = true
      isError.value = false
      return
    }

    // 缓存未命中，尝试缓存图片
    const blobUrl = await cacheImage(url)
    if (blobUrl) {
      displaySrc.value = blobUrl
      isCached.value = true
      isError.value = false
      return
    }

    // 缓存失败
    if (isForceCache()) {
      // 强制缓存模式：显示 404 占位图
      displaySrc.value = ERROR_PLACEHOLDER
      isError.value = true
      isCached.value = false
    } else {
      // 非强制模式：回退到原始 URL
      displaySrc.value = url
      isCached.value = false
    }
  } catch {
    if (isForceCache()) {
      // 强制缓存模式：显示 404 占位图
      displaySrc.value = ERROR_PLACEHOLDER
      isError.value = true
      isCached.value = false
    } else {
      // 非强制模式：回退到原始 URL
      displaySrc.value = url
      isCached.value = false
    }
  }
}

const handleImageError = async () => {
  // 如果已经是错误状态或占位图，不再处理
  if (isError.value || displaySrc.value === ERROR_PLACEHOLDER) {
    return
  }

  // 如果是 blob URL 失败，可能是缓存已过期，尝试重新缓存
  if (displaySrc.value.startsWith('blob:') && props.src) {
    try {
      const { cacheImage } = await import('@/utils/imageCache')
      const blobUrl = await cacheImage(props.src)
      if (blobUrl) {
        displaySrc.value = blobUrl
        isCached.value = true
        return
      }
    } catch {
      // 重新缓存失败
    }
  }

  // 强制缓存模式下显示 404
  if (isForceCache()) {
    displaySrc.value = ERROR_PLACEHOLDER
    isError.value = true
  }
}

// 监听 src 变化
watch(
  () => props.src,
  newSrc => {
    if (newSrc) {
      isCached.value = false
      isError.value = false
      loadCachedImage(newSrc)
    }
  },
  { immediate: false }
)

// 初始加载
onMounted(() => {
  if (props.src) {
    loadCachedImage(props.src)
  }
})
</script>

<template>
  <img
    :src="displaySrc"
    :alt="alt || ''"
    :class="$props.class"
    :title="title"
    :loading="loading || 'lazy'"
    :data-original-url="src"
    :data-cached="isCached ? 'true' : undefined"
    :data-error="isError ? 'true' : undefined"
    @error="handleImageError"
  />
</template>
