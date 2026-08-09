import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import {
  fetchDiscourseEmojiGroups,
  type DiscourseEmojiEntry,
  type DiscourseEmojiGroup
} from '../linux.do/emojis'

import '../css/DiscourseEmojiPicker.css'

type PickerMode = 'reaction' | 'shortcode'

export default defineComponent({
  name: 'DiscourseEmojiPicker',
  props: {
    visible: { type: Boolean, required: true },
    baseUrl: { type: String, required: true },
    mode: { type: String as () => PickerMode, default: 'reaction' },
    closeOnSelect: { type: Boolean, default: true }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const pickerRef = ref<HTMLDivElement | null>(null)
    const groups = ref<DiscourseEmojiGroup[]>([])
    const query = ref('')
    const loading = ref(false)
    const loadError = ref('')
    const activeGroupIndex = ref(0)
    let loadSequence = 0

    const filteredGroups = computed(() => {
      const search = query.value.trim().toLowerCase()
      if (!search) return groups.value

      return groups.value
        .map(group => ({
          ...group,
          emojis: group.emojis.filter(emoji => {
            const haystack = [emoji.name, ...(emoji.search_aliases || [])].join(' ').toLowerCase()
            return haystack.includes(search)
          })
        }))
        .filter(group => group.emojis.length > 0)
    })

    const loadGroups = async () => {
      const sequence = ++loadSequence
      loading.value = true
      loadError.value = ''
      try {
        const result = await fetchDiscourseEmojiGroups(props.baseUrl)
        if (sequence !== loadSequence) return
        groups.value = result
        activeGroupIndex.value = 0
        if (result.length === 0) loadError.value = '站点没有返回可用表情'
      } catch (error) {
        if (sequence !== loadSequence) return
        groups.value = []
        loadError.value = error instanceof Error ? error.message : '加载站点表情失败'
      } finally {
        if (sequence === loadSequence) loading.value = false
      }
    }

    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.discourse-emoji-picker-trigger')) return
      if (target instanceof Node && !pickerRef.value?.contains(target)) {
        emit('close')
      }
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') emit('close')
    }

    const updateDismissListeners = (visible: boolean) => {
      document.removeEventListener('pointerdown', handleClickOutside, true)
      document.removeEventListener('keydown', handleKeydown)
      if (visible) {
        document.addEventListener('pointerdown', handleClickOutside, true)
        document.addEventListener('keydown', handleKeydown)
      }
    }

    watch(
      () => props.visible,
      visible => {
        updateDismissListeners(visible)
        if (visible) {
          query.value = ''
          void loadGroups()
        }
      },
      { immediate: true, flush: 'sync' }
    )

    watch(
      () => props.baseUrl,
      () => {
        if (props.visible) void loadGroups()
      }
    )

    onBeforeUnmount(() => updateDismissListeners(false))

    const getEntryLabel = (entry: DiscourseEmojiEntry) => `:${entry.name}:`

    const handleSelect = (entry: DiscourseEmojiEntry) => {
      const value = props.mode === 'shortcode' ? getEntryLabel(entry) : entry.name
      emit('select', value)
      if (props.closeOnSelect) emit('close')
    }

    const scrollToGroup = async (index: number) => {
      activeGroupIndex.value = index
      await nextTick()
      const section = pickerRef.value?.querySelector<HTMLElement>(
        `[data-emoji-group-index="${index}"]`
      )
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const getGroupIcon = (group: DiscourseEmojiGroup) =>
      group.icon || group.emojis[0]?.unicode || '📁'

    return () => {
      if (!props.visible) return null

      const displayGroups = filteredGroups.value
      const title = props.mode === 'shortcode' ? '插入站点表情短码' : '选择反应'

      return (
        <div
          ref={pickerRef}
          class="discourse-emoji-picker"
          role="dialog"
          aria-label={title}
          aria-modal="false"
        >
          <div class="discourse-emoji-picker__header">
            <div>
              <strong>{title}</strong>
              <span class="discourse-emoji-picker__hint">
                {props.mode === 'shortcode' ? '点击后插入 :name:' : '表情来自当前站点'}
              </span>
            </div>
            <button
              type="button"
              class="discourse-emoji-picker__close"
              aria-label="关闭表情面板"
              onClick={() => emit('close')}
            >
              ×
            </button>
          </div>

          <label class="discourse-emoji-picker__search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query.value}
              type="search"
              placeholder="搜索表情名称或别名"
              aria-label="搜索站点表情"
              onInput={(event: Event) => (query.value = (event.target as HTMLInputElement).value)}
            />
          </label>

          {loading.value && <div class="discourse-emoji-picker__state">正在从站点加载表情…</div>}
          {!loading.value && loadError.value && (
            <div class="discourse-emoji-picker__state is-error">{loadError.value}</div>
          )}
          {!loading.value && !loadError.value && displayGroups.length === 0 && (
            <div class="discourse-emoji-picker__state">没有找到匹配的站点表情</div>
          )}
          {!loading.value && displayGroups.length > 0 && (
            <div class="discourse-emoji-picker__content">
              {!query.value.trim() && (
                <div class="discourse-emoji-picker__nav" role="tablist" aria-label="表情分类">
                  {groups.value.map((group, index) => (
                    <button
                      type="button"
                      key={group.id}
                      role="tab"
                      aria-selected={activeGroupIndex.value === index}
                      class={[
                        'discourse-emoji-picker__nav-item',
                        activeGroupIndex.value === index ? 'is-active' : ''
                      ]}
                      title={group.name}
                      onClick={() => void scrollToGroup(index)}
                    >
                      {group.emojis[0]?.url ? (
                        <img src={group.emojis[0].url} alt="" loading="lazy" />
                      ) : (
                        getGroupIcon(group)
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div class="discourse-emoji-picker__scrollable">
                {displayGroups.map((group, index) => (
                  <section
                    key={group.id}
                    class="discourse-emoji-picker__section"
                    data-emoji-group-index={index}
                    aria-label={group.name}
                  >
                    <h3>{group.name}</h3>
                    <div class="discourse-emoji-picker__grid">
                      {group.emojis.map(entry => (
                        <button
                          type="button"
                          key={`${group.id}-${entry.id}-${entry.name}`}
                          class="discourse-emoji-picker__item"
                          title={getEntryLabel(entry)}
                          aria-label={getEntryLabel(entry)}
                          onClick={() => handleSelect(entry)}
                        >
                          {entry.url ? (
                            <img src={entry.url} alt={entry.name} loading="lazy" />
                          ) : (
                            <span class="discourse-emoji-picker__unicode">
                              {entry.unicode || entry.name}
                            </span>
                          )}
                          {props.mode === 'shortcode' && (
                            <span class="discourse-emoji-picker__item-name">:{entry.name}:</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }
  }
})
