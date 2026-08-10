/* @jsxImportSource vue */
import { defineComponent, ref, computed, watch, onMounted, Teleport, Transition } from 'vue'

import {
  fetchDiscourseEmojiGroups,
  type DiscourseEmojiEntry,
  type DiscourseEmojiGroup
} from '@/options/components/discourse/linux.do/emojis'

export default defineComponent({
  name: 'EmojiPicker',
  props: {
    show: { type: Boolean, default: false },
    position: { type: Object as () => { x: number; y: number } | null, default: null },
    baseUrl: { type: String, default: null }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const searchQuery = ref('')
    const activeGroup = ref<string>('')
    const emojiGroups = ref<DiscourseEmojiGroup[]>([])
    const loading = ref(false)

    const loadDiscourseEmojis = async () => {
      if (!props.baseUrl) return
      loading.value = true
      try {
        const groups = await fetchDiscourseEmojiGroups(props.baseUrl)
        emojiGroups.value = groups
        if (!activeGroup.value && groups.length) {
          activeGroup.value = groups[0].id
        }
      } finally {
        loading.value = false
      }
    }

    onMounted(async () => {
      await loadDiscourseEmojis()
    })

    const filteredEmojis = computed(() => {
      if (!searchQuery.value.trim()) {
        const group = emojiGroups.value.find(g => g.id === activeGroup.value)
        return group?.emojis || []
      }

      const query = searchQuery.value.toLowerCase()
      return emojiGroups.value.flatMap(g =>
        g.emojis.filter(
          e => e.name.toLowerCase().includes(query) || e.id.toLowerCase().includes(query)
        )
      )
    })

    const availableGroups = computed(() => {
      return emojiGroups.value
    })

    const selectEmoji = (emoji: DiscourseEmojiEntry) => {
      emit('select', {
        name: emoji.name,
        url: emoji.url || '',
        shortcode: `:${emoji.name}:`
      })
      emit('close')
    }

    const closePicker = () => {
      emit('close')
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker()
      }
    }

    const pickerStyle = computed(() => {
      if (!props.position) return {}
      const width = 400
      const height = 520
      const padding = 12
      const maxX = window.innerWidth - width - padding
      const maxY = window.innerHeight - height - padding
      const left = Math.max(padding, Math.min(props.position.x, maxX))
      const top = Math.max(padding, Math.min(props.position.y, maxY))
      return { left: `${left}px`, top: `${top}px`, position: 'fixed' }
    })

    watch(
      () => props.baseUrl,
      () => {
        emojiGroups.value = []
        activeGroup.value = ''
        void loadDiscourseEmojis()
      }
    )

    return () => (
      <Teleport to="body">
        <Transition name="emoji-picker">
          {props.show ? (
            <div
              class={['emoji-picker-overlay', { positioned: !!props.position }]}
              onClick={event => {
                if (event.target === event.currentTarget) closePicker()
              }}
              onKeydown={handleKeydown}
              tabindex={-1}
            >
              <div class="emoji-picker" style={pickerStyle.value as any}>
                <div class="emoji-picker-header">
                  <input
                    value={searchQuery.value}
                    onInput={event => {
                      searchQuery.value = (event.target as HTMLInputElement).value
                    }}
                    type="text"
                    placeholder="搜索表情..."
                    class="emoji-search-input"
                    autofocus
                  />
                  <button class="emoji-close-btn" onClick={closePicker}>
                    ×
                  </button>
                </div>

                {searchQuery.value ? null : (
                  <div class="emoji-groups-tabs">
                    {availableGroups.value.map(group => (
                      <button
                        key={group.id}
                        class={['emoji-group-tab', { active: activeGroup.value === group.id }]}
                        onClick={() => {
                          activeGroup.value = group.id
                        }}
                        title={group.name}
                      >
                        {group.emojis[0]?.url ? (
                          <span class="group-icon-img">
                            <img src={group.emojis[0].url} alt={group.name} />
                          </span>
                        ) : (
                          <span class="group-icon-text">🙂</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div class="emoji-grid-container">
                  {loading.value ? (
                    <div class="emoji-empty">加载中...</div>
                  ) : filteredEmojis.value.length === 0 ? (
                    <div class="emoji-empty">没有找到表情</div>
                  ) : (
                    <div class="emoji-grid">
                      {filteredEmojis.value.map(emoji => (
                        <button
                          key={emoji.id}
                          class="emoji-item"
                          title={emoji.name}
                          onClick={() => selectEmoji(emoji)}
                        >
                          {emoji.url ? (
                            <img src={emoji.url} alt={emoji.name} loading="lazy" />
                          ) : (
                            <span aria-hidden="true">{emoji.unicode || emoji.name}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div class="emoji-picker-footer">
                  <span class="emoji-hint">使用 :表情名称：格式输入表情</span>
                </div>
              </div>
            </div>
          ) : null}
        </Transition>
      </Teleport>
    )
  }
})
