import { defineComponent, ref, computed, onMounted, Teleport, Transition } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'

type PluginEmojiPickerProps = {
  show?: boolean
  position?: { x: number; y: number } | null
}

type PickerEmoji = { id: string; name: string; url: string }

type PickerGroup = { id: string; name: string; icon: string; emojis: PickerEmoji[] }

export default defineComponent({
  name: 'PluginEmojiPicker',
  props: {
    show: { type: Boolean, default: false },
    position: { type: Object as () => { x: number; y: number } | null, default: null }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const emojiStore = useEmojiStore()
    const searchQuery = ref('')
    const activeGroup = ref<string>('')

    onMounted(async () => {
      await emojiStore.loadData()
      const firstGroup = emojiStore.groups.find(g => g.id !== 'favorites')
      if (firstGroup) activeGroup.value = firstGroup.id
    })

    const groups = computed<PickerGroup[]>(() => {
      return emojiStore.groups
        .filter(g => g.id !== 'favorites')
        .map(group => ({
          id: group.id,
          name: group.name,
          icon: group.icon,
          emojis: (group.emojis || []).map(e => ({
            id: e.id,
            name: e.name,
            url: e.url
          }))
        }))
    })

    const filteredEmojis = computed(() => {
      const query = searchQuery.value.trim().toLowerCase()
      if (!query) {
        const group = groups.value.find(g => g.id === activeGroup.value)
        return group?.emojis || []
      }
      return groups.value.flatMap(group =>
        group.emojis.filter(e => e.name.toLowerCase().includes(query) || e.id.toLowerCase().includes(query))
      )
    })

    const closePicker = () => {
      emit('close')
    }

    const selectEmoji = (emoji: PickerEmoji) => {
      emit('select', emoji)
      emit('close')
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

    return () => (
      <Teleport to="body">
        <Transition name="plugin-emoji-picker">
          {props.show ? (
            <div
              class={['plugin-emoji-picker-overlay', { positioned: !!props.position }]}
              onClick={event => {
                if (event.target === event.currentTarget) closePicker()
              }}
              tabindex={-1}
            >
              <div class="plugin-emoji-picker" style={pickerStyle.value as any}>
                <div class="plugin-emoji-picker-header">
                  <input
                    value={searchQuery.value}
                    onInput={event => {
                      searchQuery.value = (event.target as HTMLInputElement).value
                    }}
                    type="text"
                    placeholder="搜索插件表情..."
                    class="plugin-emoji-search-input"
                    autofocus
                  />
                  <button class="plugin-emoji-close-btn" onClick={closePicker}>
                    ×
                  </button>
                </div>

                {searchQuery.value ? null : (
                  <div class="plugin-emoji-groups-tabs">
                    {groups.value.map(group => (
                      <button
                        key={group.id}
                        class={['plugin-emoji-group-tab', { active: activeGroup.value === group.id }]}
                        onClick={() => {
                          activeGroup.value = group.id
                        }}
                        title={group.name}
                      >
                        {group.icon?.startsWith('http') ? (
                          <span class="plugin-group-icon-img">
                            <img src={group.icon} alt={group.name} />
                          </span>
                        ) : (
                          <span class="plugin-group-icon-text">{group.icon || '🙂'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div class="plugin-emoji-grid-container">
                  {filteredEmojis.value.length === 0 ? (
                    <div class="plugin-emoji-empty">没有找到表情</div>
                  ) : (
                    <div class="plugin-emoji-grid">
                      {filteredEmojis.value.map(emoji => (
                        <button
                          key={emoji.id}
                          class="plugin-emoji-item"
                          title={emoji.name}
                          onClick={() => selectEmoji(emoji)}
                        >
                          <img src={emoji.url} alt={emoji.name} loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div class="plugin-emoji-picker-footer">
                  <span class="plugin-emoji-hint">点击插入插件表情</span>
                </div>
              </div>
            </div>
          ) : null}
        </Transition>
      </Teleport>
    )
  }
})
