<script setup lang="ts">
/**
 * CachedImage 组件
 * 自动使用 IndexedDB 缓存的图片，如果缓存可用则使用 blob URL
 * 当启用 IndexedDB 缓存时，强制使用缓存，失败则显示 404 占位图
 * 加载过程中显示转圈动画
 */
import { ref, watch, onMounted } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import {
  resolveImageCacheStrategy,
  isImageDomainBlocked,
  shouldUseImageCache
} from '@/utils/imageCachePolicy'

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
const isLoading = ref(false)

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
  const strategy = resolveImageCacheStrategy(emojiStore.settings)
  if (strategy === 'force-source') return false
  if (shouldUseImageCache(emojiStore.settings)) return true
  // Extension pages can't embed some cross-origin images due to CORP.
  return isExtensionPage() && (url.startsWith('http://') || url.startsWith('https://'))
}

const shouldForceCache = (url: string) => {
  const strategy = resolveImageCacheStrategy(emojiStore.settings)
  if (strategy === 'force-indexeddb') return true
  if (strategy === 'adaptive' && isImageDomainBlocked(url)) return true
  return false
}

// 异步获取缓存的图片 URL
const loadCachedImage = async (
  url: string,
  options: { forceCache?: boolean; fallbackToSource?: boolean } = {}
) => {
  if (!url) {
    displaySrc.value = url
    return
  }

  // 对于 blob: 和 data: URL，直接使用
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    displaySrc.value = url
    isLoading.value = false
    return
  }

  if (!shouldUseCache(url)) {
    displaySrc.value = url
    isLoading.value = false
    return
  }

  // 开始加载，显示 loading 状态
  isLoading.value = true
  isError.value = false

  try {
    const { getCachedImage, cacheImage } = await import('@/utils/imageCache')

    // 先尝试从缓存获取
    const cachedUrl = await getCachedImage(url)
    if (cachedUrl) {
      displaySrc.value = cachedUrl
      isCached.value = true
      isError.value = false
      isLoading.value = false
      return
    }

    // 缓存未命中，尝试缓存图片
    const blobUrl = await cacheImage(url)
    if (blobUrl) {
      displaySrc.value = blobUrl
      isCached.value = true
      isError.value = false
      isLoading.value = false
      return
    }

    // 缓存失败
    isLoading.value = false
    const forceCache = options.forceCache ?? false
    const fallbackToSource = options.fallbackToSource ?? !forceCache

    if (forceCache) {
      // 强制缓存模式：显示 404 占位图
      displaySrc.value = ERROR_PLACEHOLDER
      isError.value = true
      isCached.value = false
    } else if (fallbackToSource) {
      // 非强制模式：回退到原始 URL
      displaySrc.value = url
      isCached.value = false
    } else {
      displaySrc.value = ERROR_PLACEHOLDER
      isError.value = true
      isCached.value = false
    }
  } catch {
    isLoading.value = false
    const forceCache = options.forceCache ?? false
    const fallbackToSource = options.fallbackToSource ?? !forceCache

    if (forceCache) {
      // 强制缓存模式：显示 404 占位图
      displaySrc.value = ERROR_PLACEHOLDER
      isError.value = true
      isCached.value = false
    } else if (fallbackToSource) {
      // 非强制模式：回退到原始 URL
      displaySrc.value = url
      isCached.value = false
    } else {
      displaySrc.value = ERROR_PLACEHOLDER
      isError.value = true
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

  const strategy = resolveImageCacheStrategy(emojiStore.settings)

  // Force-source 模式：在扩展页仍允许回退到缓存，否则容易被 CORP 阻断
  if (strategy === 'force-source') {
    if (props.src && isExtensionPage()) {
      await loadCachedImage(props.src, { forceCache: true, fallbackToSource: false })
      return
    }
    displaySrc.value = ERROR_PLACEHOLDER
    isError.value = true
    return
  }

  // 失败后尝试缓存加载（auto/adaptive/force-indexeddb）
  if (props.src) {
    await loadCachedImage(props.src, { forceCache: true, fallbackToSource: false })
    return
  }

  displaySrc.value = ERROR_PLACEHOLDER
  isError.value = true
}

// 监听 src 变化
watch(
  () => props.src,
  newSrc => {
    if (newSrc) {
      isCached.value = false
      isError.value = false
      isLoading.value = false
      const forceCache = shouldForceCache(newSrc)
      const preferCache = shouldUseCache(newSrc) && (forceCache || isExtensionPage())
      if (preferCache) {
        loadCachedImage(newSrc, {
          forceCache,
          fallbackToSource: !forceCache
        })
      } else {
        displaySrc.value = newSrc
      }
    }
  },
  { immediate: false }
)

// 初始加载
onMounted(() => {
  if (props.src) {
    const forceCache = shouldForceCache(props.src)
    const preferCache = shouldUseCache(props.src) && (forceCache || isExtensionPage())
    if (preferCache) {
      loadCachedImage(props.src, { forceCache, fallbackToSource: !forceCache })
    } else {
      displaySrc.value = props.src
    }
  }
})
</script>

<template>
  <div class="cached-image-wrapper" :class="$props.class">
    <!-- Loading spinner -->
    <div v-if="isLoading" class="cached-image-loading">
      <svg class="cached-image-spinner" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="31.4 31.4"
        />
      </svg>
    </div>
    <!-- Image -->
    <img
      v-show="!isLoading"
      :src="displaySrc"
      :alt="alt || ''"
      class="cached-image-img"
      :title="title"
      :loading="loading || 'lazy'"
      :data-original-url="src"
      :data-cached="isCached ? 'true' : undefined"
      :data-error="isError ? 'true' : undefined"
      @error="handleImageError"
    />
  </div>
</template>

<style scoped>
.cached-image-wrapper {
  position: relative;
  display: inline-block;
}

.cached-image-img {
  width: 100%;
  height: 100%;
  object-fit: inherit;
  display: block;
}

.cached-image-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 32px;
  min-height: 32px;
  background: #f5f5f5;
  border-radius: 4px;
}

.cached-image-spinner {
  width: 24px;
  height: 24px;
  color: #999;
  animation: cached-image-spin 1s linear infinite;
}

@keyframes cached-image-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .cached-image-loading {
    background: #333;
  }
  .cached-image-spinner {
    color: #666;
  }
}
</style>
