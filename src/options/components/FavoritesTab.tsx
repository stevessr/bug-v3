import { defineComponent, computed, ref, onMounted, watch } from 'vue'
import { Badge, Button, Popconfirm, message } from 'ant-design-vue'
import { QuestionCircleOutlined, DeleteOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import { shouldPreferCache, shouldUseImageCache } from '../../utils/imageCachePolicy'
import {
  getEmojiImageUrlWithLoading,
  getEmojiImageUrlSync,
  preloadImages
} from '../../utils/imageUrlHelper'
import CachedImage from '../../components/CachedImage.vue'

const favoriteStarStyle = {
  fontSize: '12px',
  background: 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)',
  borderRadius: '50%',
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(255, 215, 0, 0.4)'
} as const

export default defineComponent({
  name: 'FavoritesTab',
  emits: ['remove', 'edit'],
  setup(_, { emit }) {
    const emojiStore = useEmojiStore()
    const imageSources = ref<Map<string, string>>(new Map())

    const favoritesGroup = computed(() => {
      return emojiStore.sortedGroups.find(g => g.id === 'favorites')
    })

    const getEmojiKey = (emoji: { id?: string; url?: string }, idx: number) =>
      emoji.id || emoji.url || `fav-${idx}`

    const handleClearAllFavorites = () => {
      emojiStore.clearAllFavorites()
      message.success('已清空所有常用表情')
    }

    const initializeImageSources = async () => {
      if (!favoritesGroup.value?.emojis) return

      const newSources = new Map<string, string>()

      for (const [idx, emoji] of favoritesGroup.value.emojis.entries()) {
        try {
          const key = getEmojiKey(emoji, idx)
          if (shouldPreferCache(emojiStore.settings, emoji.displayUrl || emoji.url || '')) {
            const result = await getEmojiImageUrlWithLoading(emoji, { preferCache: true })
            newSources.set(key, result.url)
          } else {
            const fallbackSrc = emoji.displayUrl || emoji.url
            newSources.set(key, fallbackSrc)
          }
        } catch {
          const fallbackSrc = emoji.displayUrl || emoji.url
          newSources.set(getEmojiKey(emoji, idx), fallbackSrc)
        }
      }

      imageSources.value = newSources
    }

    const preloadFavoriteImages = async () => {
      if (!favoritesGroup.value?.emojis || !shouldUseImageCache(emojiStore.settings)) {
        return
      }
      try {
        await preloadImages(favoritesGroup.value.emojis, { batchSize: 3, delay: 50 })
      } catch {
        // ignore
      }
    }

    watch(
      () => favoritesGroup.value?.emojis,
      () => {
        initializeImageSources()
      },
      { deep: true }
    )

    onMounted(() => {
      initializeImageSources()
      preloadFavoriteImages()
    })

    return () => (
      <div class="space-y-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">常用表情</h2>
              {favoritesGroup.value && favoritesGroup.value.emojis?.length ? (
                <Popconfirm
                  title="确认清空所有常用表情吗？此操作不可撤销。"
                  ok-text="确认"
                  cancel-text="取消"
                  onConfirm={handleClearAllFavorites}
                  v-slots={{
                    icon: () => <QuestionCircleOutlined style="color: red" />
                  }}
                >
                  <Button danger size="small" v-slots={{ icon: () => <DeleteOutlined /> }}>
                    清空常用
                  </Button>
                </Popconfirm>
              ) : null}
            </div>
          </div>

          <div class="p-6">
            {favoritesGroup.value && favoritesGroup.value.emojis?.length ? (
              <div
                class="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
                }}
              >
                {favoritesGroup.value.emojis.map((emoji, idx) => {
                  const key = getEmojiKey(emoji, idx)
                  const showStar = !emoji.usageCount || emoji.usageCount === 0
                  return (
                    <div key={`fav-${key}`} class="emoji-item relative group">
                      <Badge
                        class="block w-full"
                        count={emoji.usageCount && emoji.usageCount > 0 ? emoji.usageCount : 0}
                        overflowCount={99}
                        showZero={false}
                        v-slots={
                          showStar
                            ? {
                                count: () => <span style={favoriteStarStyle}>⭐</span>
                              }
                            : undefined
                        }
                      >
                        <div class="aspect-square bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                          <CachedImage
                            src={imageSources.value.get(key) || getEmojiImageUrlSync(emoji)}
                            alt={emoji.name}
                            class="w-full h-full object-cover"
                          />
                        </div>
                      </Badge>
                      <div class="mt-2 flex justify-center items-center">
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-2">
                          <Button
                            onClick={() => emit('edit', emoji, 'favorites', idx)}
                            title="编辑"
                            class="text-xs px-2 py-0.5 bg-white bg-opacity-90 dark:bg-gray-700 rounded hover:bg-opacity-100"
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确认移除此表情？"
                            onConfirm={() => emit('remove', 'favorites', idx)}
                            v-slots={{
                              icon: () => <QuestionCircleOutlined style="color: red" />
                            }}
                          >
                            <Button
                              title="移除"
                              class="text-xs px-2 py-0.5 bg-white bg-opacity-90 dark:bg-gray-700 rounded hover:bg-opacity-100"
                            >
                              移除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                      <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
                        {emoji.name}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div class="text-sm text-gray-500 dark:text-white">
                尚无常用表情，使用表情后会自动添加到常用。
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
})
