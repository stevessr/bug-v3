import { defineComponent, computed } from 'vue'
import { Button, Popconfirm, message } from 'ant-design-vue'
import { QuestionCircleOutlined, DeleteOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import CachedImage from '../../components/CachedImage.vue'
import { useEmojiImages } from '../../composables/useEmojiImages'
import './FavoritesTab.css'

export default defineComponent({
  name: 'FavoritesTab',
  emits: ['remove', 'edit'],
  setup(_, { emit }) {
    const emojiStore = useEmojiStore()

    const favoritesGroup = computed(() => {
      return emojiStore.sortedGroups.find(g => g.id === 'favorites')
    })

    const favoritesEmojis = computed(() => favoritesGroup.value?.emojis || [])

    const { imageSources, getImageSrcSync } = useEmojiImages(() => favoritesEmojis.value, {
      preload: true,
      preloadBatchSize: 3,
      preloadDelay: 50,
      preloadWhenActive: false
    })

    const handleClearAllFavorites = () => {
      emojiStore.clearAllFavorites()
      message.success('已清空所有常用表情')
    }

    return () => (
      <div class="space-y-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">常用表情</h2>
              {favoritesEmojis.value.length ? (
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
            {favoritesEmojis.value.length ? (
              <div
                class="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
                }}
              >
                {favoritesEmojis.value.map((emoji, idx) => {
                  const src = imageSources.value.get(emoji.id) || getImageSrcSync(emoji)
                  const usageCount = emoji.usageCount || 0
                  return (
                    <div
                      key={`fav-${emoji.id || idx}`}
                      class="emoji-card relative group"
                    >
                      <div class="emoji-thumb bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 relative">
                        <CachedImage
                          src={src}
                          alt={emoji.name}
                          class="w-full h-full object-contain"
                          loading="lazy"
                        />
                        {usageCount > 0 ? (
                          <span class="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                            {usageCount > 99 ? '99+' : usageCount}
                          </span>
                        ) : (
                          <span
                            class="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                            style={{
                              background: 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)',
                              boxShadow: '0 2px 4px rgba(255, 215, 0, 0.4)'
                            }}
                          >
                            ⭐
                          </span>
                        )}
                      </div>

                      <div class="emoji-name text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
                        {emoji.name}
                      </div>

                      <div class="absolute bottom-6 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => emit('edit', emoji, 'favorites', idx)}
                          size="small"
                          class="text-xs px-2 py-0.5"
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
                          <Button size="small" class="text-xs px-2 py-0.5">
                            移除
                          </Button>
                        </Popconfirm>
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
