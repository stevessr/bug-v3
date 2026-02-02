<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { pageFetch } from './utils'

const props = defineProps<{
  originalSrc: string
  alt?: string
  width?: string | number
  height?: string | number
  srcset?: string
  loading?: string
  style?: Record<string, string>
  fallbackSrc?: string
}>()

const imageUrl = ref<string | null>(null)
const hasError = ref(false)

const handleLoad = () => {
  // 图片加载成功
}

const handleError = () => {
  // 如果代理加载失败，回退到原始源
  hasError.value = true
}

onMounted(async () => {
  try {
    // 尝试通过 PAGE_FETCH 代理获取图片
    const response = await pageFetch<Blob>(props.originalSrc, {}, 'blob')

    if (response.ok && response.data) {
      // 创建 blob URL
      const blob = response.data as unknown as Blob
      imageUrl.value = URL.createObjectURL(blob)
    } else {
      // 如果代理请求失败，使用原始 URL
      imageUrl.value = props.originalSrc
    }
  } catch (error) {
    console.warn(`[ImageProxy] Failed to load image via proxy: ${props.originalSrc}`, error)
    // 如果代理加载失败，使用原始 URL 或备用 URL
    imageUrl.value = props.originalSrc
  }
})
</script>
<template>
  <img
    v-if="imageUrl"
    :src="imageUrl"
    :alt="props.alt"
    :width="props.width"
    :height="props.height"
    :srcset="props.srcset"
    :loading="props.loading"
    :style="props.style"
    @error="handleError"
    @load="handleLoad"
  />
  <img
    v-else
    :src="props.fallbackSrc || props.originalSrc"
    :alt="props.alt"
    :width="props.width"
    :height="props.height"
    :srcset="props.srcset"
    :loading="props.loading"
    :style="props.style"
  />
</template>
