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

// 异步获取缓存的图片 URL
const loadCachedImage = async (url: string) => {
  if (!url || !emojiStore.settings.useIndexedDBForImages) {
    displaySrc.value = url
    return
  }

  try {
    const { getCachedImage } = await import('@/utils/imageCache')
    const cachedUrl = await getCachedImage(url)
    if (cachedUrl) {
      displaySrc.value = cachedUrl
      isCached.value = true
    } else {
      displaySrc.value = url
      isCached.value = false
    }
  } catch {
    displaySrc.value = url
    isCached.value = false
  }
}

// 监听 src 变化
watch(
  () => props.src,
  newSrc => {
    if (newSrc) {
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
  />
</template>
