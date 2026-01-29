<script setup lang="ts">
/**
 * CachedImage 组件
 * 自动使用 IndexedDB 缓存的图片，如果缓存可用则使用 blob URL
 * 回退到原始 URL 以确保图片始终可显示
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
const hasTriedFallback = ref(false)

const shouldUseCache = (url: string) => {
  if (!url) return false
  if (emojiStore.settings.useIndexedDBForImages) return true
  // Extension pages can’t embed some cross-origin images due to CORP.
  return isExtensionPage() && (url.startsWith('http://') || url.startsWith('https://'))
}

// 异步获取缓存的图片 URL
const loadCachedImage = async (url: string) => {
  if (!url || !shouldUseCache(url)) {
    displaySrc.value = url
    return
  }

  try {
    const { getCachedImage, cacheImage } = await import('@/utils/imageCache')
    const cachedUrl = await getCachedImage(url)
    if (cachedUrl) {
      displaySrc.value = cachedUrl
      isCached.value = true
    } else {
      const blobUrl = await cacheImage(url)
      if (blobUrl) {
        displaySrc.value = blobUrl
        isCached.value = true
      } else {
        displaySrc.value = url
        isCached.value = false
      }
    }
  } catch {
    displaySrc.value = url
    isCached.value = false
  }
}

const isExtensionPage = () =>
  typeof window !== 'undefined' &&
  (window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'moz-extension:' ||
    window.location.protocol === 'safari-extension:')

const shouldAttemptFallback = (url: string) => {
  if (!url) return false
  if (url.startsWith('blob:') || url.startsWith('data:')) return false
  return isExtensionPage()
}

const handleImageError = async () => {
  if (hasTriedFallback.value || !shouldAttemptFallback(displaySrc.value)) {
    return
  }

  hasTriedFallback.value = true

  try {
    const { cacheImage } = await import('@/utils/imageCache')
    const blobUrl = await cacheImage(displaySrc.value)
    if (blobUrl) {
      displaySrc.value = blobUrl
      isCached.value = true
    }
  } catch {
    // 保持原始 URL，避免无限重试
  }
}

// 监听 src 变化
watch(
  () => props.src,
  newSrc => {
    if (newSrc) {
      hasTriedFallback.value = false
      isCached.value = false
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
    @error="handleImageError"
  />
</template>
