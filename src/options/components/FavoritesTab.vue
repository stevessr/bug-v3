<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { QuestionCircleOutlined, DeleteOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import { shouldPreferCache, shouldUseImageCache } from '../../utils/imageCachePolicy'
import {
  getEmojiImageUrlWithLoading,
  getEmojiImageUrlSync,
  preloadImages
} from '../../utils/imageUrlHelper'
import CachedImage from '../../components/CachedImage.vue'

defineEmits(['remove', 'edit'])

const emojiStore = useEmojiStore()
const imageSources = ref<Map<string, string>>(new Map())
const loadingStates = ref<Map<string, boolean>>(new Map())

const favoritesGroup = computed(() => {
  return emojiStore.sortedGroups.find(g => g.id === 'favorites')
})

const getEmojiKey = (emoji: { id?: string; url?: string }, idx: number) =>
  emoji.id || emoji.url || `fav-${idx}`

const handleClearAllFavorites = () => {
  emojiStore.clearAllFavorites()
  message.success('已清空所有常用表情')
}

// Initialize image sources with caching
const initializeImageSources = async () => {
  if (!favoritesGroup.value?.emojis) return

  console.log(
    '[FavoritesTab] Initializing image sources for favorites:',
    favoritesGroup.value.emojis.length
  )
  console.log('[FavoritesTab] Cache enabled:', shouldUseImageCache(emojiStore.settings))

  const newSources = new Map<string, string>()
  const newLoadingStates = new Map<string, boolean>()

  for (const [idx, emoji] of favoritesGroup.value.emojis.entries()) {
    try {
      const key = getEmojiKey(emoji, idx)
      if (shouldPreferCache(emojiStore.settings, emoji.displayUrl || emoji.url || '')) {
        // Use the new loading function in cache mode
        const result = await getEmojiImageUrlWithLoading(emoji, { preferCache: true })
        newSources.set(key, result.url)
        newLoadingStates.set(key, result.isLoading)
        console.log(
          `[FavoritesTab] Image source for ${emoji.name}:`,
          result.url,
          'from cache:',
          result.isFromCache
        )
      } else {
        // Direct URL mode
        const fallbackSrc = emoji.displayUrl || emoji.url
        newSources.set(key, fallbackSrc)
        console.log(`[FavoritesTab] Direct URL for ${emoji.name}:`, fallbackSrc)
      }
    } catch (error) {
      console.warn(`[FavoritesTab] Failed to get image source for ${emoji.name}:`, error)
      // Fallback to direct URL
      const fallbackSrc = emoji.displayUrl || emoji.url
      newSources.set(getEmojiKey(emoji, idx), fallbackSrc)
    }
  }

  imageSources.value = newSources
  loadingStates.value = newLoadingStates
  console.log('[FavoritesTab] Image sources initialized:', imageSources.value.size)
}

// Preload favorite images for better performance
const preloadFavoriteImages = async () => {
  if (!favoritesGroup.value?.emojis || !shouldUseImageCache(emojiStore.settings)) {
    console.log('[FavoritesTab] Skipping preload - cache disabled or no emojis')
    return
  }

  try {
    console.log('[FavoritesTab] Starting preload for', favoritesGroup.value.emojis.length, 'emojis')
    await preloadImages(favoritesGroup.value.emojis, { batchSize: 3, delay: 50 })
    console.log('[FavoritesTab] Preload completed')
  } catch (error) {
    console.warn('[FavoritesTab] Failed to preload favorite images:', error)
  }
}

// Watch for changes in favorites
watch(
  () => favoritesGroup.value?.emojis,
  () => {
    console.log('[FavoritesTab] Favorites changed, reinitializing image sources')
    initializeImageSources()
  },
  { deep: true }
)

// Initialize on mount
onMounted(() => {
  console.log('[FavoritesTab] Component mounted')
  initializeImageSources()
  preloadFavoriteImages()
})
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">常用表情</h2>
          <a-popconfirm
            v-if="favoritesGroup && favoritesGroup.emojis?.length"
            title="确认清空所有常用表情吗？此操作不可撤销。"
            ok-text="确认"
            cancel-text="取消"
            @confirm="handleClearAllFavorites"
          >
            <template #icon>
              <QuestionCircleOutlined style="color: red" />
            </template>
            <a-button danger size="small">
              <template #icon>
                <DeleteOutlined />
              </template>
              清空常用
            </a-button>
          </a-popconfirm>
        </div>
      </div>

      <div class="p-6">
        <div
          v-if="favoritesGroup && favoritesGroup.emojis?.length"
          class="grid gap-3"
          :style="{
            gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
          }"
        >
          <div
            v-for="(emoji, idx) in favoritesGroup.emojis"
            :key="`fav-${getEmojiKey(emoji, idx)}`"
            class="emoji-item relative group"
          >
            <a-badge
              :count="emoji.usageCount && emoji.usageCount > 0 ? emoji.usageCount : 0"
              :overflow-count="99"
              :show-zero="false"
            >
              <template v-if="!emoji.usageCount || emoji.usageCount === 0" #count>
                <span class="favorite-star">⭐</span>
              </template>
              <div class="aspect-square bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <CachedImage
                  :src="imageSources.get(getEmojiKey(emoji, idx)) || getEmojiImageUrlSync(emoji)"
                  :alt="emoji.name"
                  class="w-full h-full object-cover"
                />
              </div>
            </a-badge>
            <!-- Actions: hidden by default, shown on hover below the image -->
            <div class="mt-2 flex justify-center items-center">
              <div
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-2"
              >
                <a-button
                  @click="$emit('edit', emoji, 'favorites', idx)"
                  title="编辑"
                  class="text-xs px-2 py-0.5 bg-white bg-opacity-90 dark:bg-gray-700 rounded hover:bg-opacity-100"
                >
                  编辑
                </a-button>
                <a-popconfirm title="确认移除此表情？" @confirm="$emit('remove', 'favorites', idx)">
                  <template #icon>
                    <QuestionCircleOutlined style="color: red" />
                  </template>
                  <a-button
                    title="移除"
                    class="text-xs px-2 py-0.5 bg-white bg-opacity-90 dark:bg-gray-700 rounded hover:bg-opacity-100"
                  >
                    移除
                  </a-button>
                </a-popconfirm>
              </div>
            </div>
            <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
              {{ emoji.name }}
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-white">
          尚无常用表情，使用表情后会自动添加到常用。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emoji-item {
  width: 80px;
}

.favorite-star {
  font-size: 12px;
  background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(255, 215, 0, 0.4);
}
</style>
