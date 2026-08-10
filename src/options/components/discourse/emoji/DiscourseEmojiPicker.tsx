import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  watch,
  type PropType
} from 'vue'

import {
  fetchDiscourseEmojiGroups,
  type DiscourseEmojiEntry,
  type DiscourseEmojiGroup
} from '../linux.do/emojis'
import { fetchDiscourseReactionCapabilities } from '../siteCapabilities'

import '../css/DiscourseEmojiPicker.css'

type PickerMode = 'reaction' | 'shortcode'

export default defineComponent({
  name: 'DiscourseEmojiPicker',
  props: {
    visible: { type: Boolean, required: true },
    baseUrl: { type: String, required: true },
    mode: { type: String as () => PickerMode, default: 'reaction' },
    closeOnSelect: { type: Boolean, default: true },
    anchorEl: { type: Object as PropType<HTMLElement | null>, default: null },
    allowedNames: { type: Array as PropType<string[] | undefined>, default: undefined },
    allowAnyEmoji: { type: Boolean as PropType<boolean | undefined>, default: undefined }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const pickerRef = ref<HTMLDivElement | null>(null)
    const groups = ref<DiscourseEmojiGroup[]>([])
    const recentNames = ref<string[]>([])
    const query = ref('')
    const loading = ref(false)
    const loadError = ref('')
    const activeGroupIndex = ref(0)
    const siteAllowedNames = ref<string[]>([])
    const siteAllowsAnyEmoji = ref(false)
    const capabilitiesAvailable = ref(true)
    const pickerStyle = ref<Record<string, string>>({})
    let loadSequence = 0

    const effectiveAllowedNames = computed(() => props.allowedNames ?? siteAllowedNames.value)
    const effectiveAllowAnyEmoji = computed(() => props.allowAnyEmoji ?? siteAllowsAnyEmoji.value)

    const recentStorageKey = computed(() => {
      try {
        return `discourse-browser:emoji-recent:v1:${encodeURIComponent(new URL(props.baseUrl).origin)}`
      } catch {
        return ''
      }
    })

    const loadRecentNames = () => {
      if (!recentStorageKey.value || typeof localStorage === 'undefined') {
        recentNames.value = []
        return
      }
      try {
        const value = JSON.parse(localStorage.getItem(recentStorageKey.value) || '[]')
        recentNames.value = Array.isArray(value)
          ? value.filter((item): item is string => typeof item === 'string').slice(0, 30)
          : []
      } catch {
        recentNames.value = []
      }
    }

    const saveRecentNames = () => {
      if (!recentStorageKey.value || typeof localStorage === 'undefined') return
      try {
        localStorage.setItem(recentStorageKey.value, JSON.stringify(recentNames.value.slice(0, 30)))
      } catch {
        // Recent history is optional when extension storage is full.
      }
    }

    const siteGroupsWithRecent = computed(() => {
      const entriesByName = new Map<string, DiscourseEmojiEntry>()
      groups.value.forEach(group => {
        group.emojis.forEach(emoji => {
          entriesByName.set(emoji.name, emoji)
          entriesByName.set(emoji.id, emoji)
        })
      })
      const recent = recentNames.value
        .map(name => entriesByName.get(name))
        .filter((entry): entry is DiscourseEmojiEntry => Boolean(entry))
      if (!recent.length) return groups.value
      return [
        {
          id: 'recent',
          name: '近期使用',
          icon: '⭐',
          emojis: recent
        },
        ...groups.value
      ]
    })

    const modeGroups = computed(() => {
      if (props.mode !== 'reaction' || effectiveAllowAnyEmoji.value)
        return siteGroupsWithRecent.value

      const allowed = new Set(
        effectiveAllowedNames.value.map(name => name.replace(/^:([^:]+):$/, '$1'))
      )
      if (!allowed.size) return []

      const present = new Set<string>()
      const filtered = siteGroupsWithRecent.value
        .map(group => ({
          ...group,
          emojis: group.emojis.filter(emoji => {
            const include = allowed.has(emoji.name) || allowed.has(emoji.id)
            if (include) present.add(emoji.name)
            return include
          })
        }))
        .filter(group => group.emojis.length > 0)

      const missing = [...allowed].filter(name => !present.has(name))
      if (missing.length > 0) {
        filtered.unshift({
          id: 'site-reactions',
          name: '站点反应',
          icon: '💬',
          emojis: missing.map(name => ({ id: name, name, url: '', group: '站点反应' }))
        })
      }
      return filtered
    })

    const filteredGroups = computed(() => {
      const search = query.value.trim().toLowerCase()
      if (!search) return modeGroups.value

      return modeGroups.value
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
        const [result, capabilities] = await Promise.all([
          fetchDiscourseEmojiGroups(props.baseUrl),
          props.mode === 'reaction' &&
          (props.allowedNames === undefined || props.allowAnyEmoji === undefined)
            ? fetchDiscourseReactionCapabilities(props.baseUrl)
            : Promise.resolve(null)
        ])
        if (sequence !== loadSequence) return
        groups.value = result
        loadRecentNames()
        if (capabilities) {
          siteAllowedNames.value = capabilities.enabledReactions
          siteAllowsAnyEmoji.value = capabilities.allowAnyEmoji
          capabilitiesAvailable.value = capabilities.source === 'site' && capabilities.enabled
        } else {
          siteAllowedNames.value = props.allowedNames || []
          siteAllowsAnyEmoji.value = props.allowAnyEmoji === true
          capabilitiesAvailable.value = true
        }
        activeGroupIndex.value = 0
        if (result.length === 0) {
          loadError.value = '站点没有返回可用表情'
        } else if (props.mode === 'reaction' && !capabilitiesAvailable.value) {
          loadError.value = '无法确认该站点允许的反应表情，已禁止添加新反应'
        } else if (props.mode === 'reaction' && modeGroups.value.length === 0) {
          loadError.value = '该站点没有提供可用的反应表情'
        }
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
      if (target instanceof Node && props.anchorEl?.contains(target)) return
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
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
      if (visible) {
        document.addEventListener('pointerdown', handleClickOutside, true)
        document.addEventListener('keydown', handleKeydown)
        window.addEventListener('resize', updatePosition)
        document.addEventListener('scroll', updatePosition, true)
      }
    }

    const updatePosition = () => {
      if (typeof window === 'undefined') return
      const padding = 12
      const gap = 8
      const width = Math.min(440, Math.max(280, window.innerWidth - padding * 2))
      const height = Math.min(520, Math.max(260, window.innerHeight - padding * 2))
      const anchor = props.anchorEl?.getBoundingClientRect()

      let left = window.innerWidth - width - padding
      let top = window.innerHeight - height - padding
      if (anchor) {
        left = anchor.right - width
        const roomAbove = anchor.top - padding - gap
        const roomBelow = window.innerHeight - anchor.bottom - padding - gap
        if (roomAbove >= Math.min(height, 320) || roomAbove >= roomBelow) {
          top = Math.max(padding, anchor.top - height - gap)
        } else {
          top = Math.min(window.innerHeight - height - padding, anchor.bottom + gap)
        }
      }

      left = Math.max(padding, Math.min(left, window.innerWidth - width - padding))
      top = Math.max(padding, Math.min(top, window.innerHeight - height - padding))
      pickerStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(width)}px`,
        maxHeight: `${Math.round(height)}px`
      }
    }

    watch(
      () => props.visible,
      visible => {
        updateDismissListeners(visible)
        if (visible) {
          query.value = ''
          void nextTick(updatePosition)
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

    watch(
      () => props.anchorEl,
      () => {
        if (props.visible) void nextTick(updatePosition)
      }
    )

    onBeforeUnmount(() => updateDismissListeners(false))

    const getEntryLabel = (entry: DiscourseEmojiEntry) => `:${entry.name}:`

    const handleSelect = (entry: DiscourseEmojiEntry) => {
      recentNames.value = [
        entry.name,
        ...recentNames.value.filter(name => name !== entry.name)
      ].slice(0, 30)
      saveRecentNames()
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

    const handleGroupScroll = (event: Event) => {
      if (query.value.trim()) return
      const container = event.currentTarget
      if (!(container instanceof HTMLElement)) return
      const sections = Array.from(
        container.querySelectorAll<HTMLElement>('[data-emoji-group-index]')
      )
      let nextIndex = 0
      for (const section of sections) {
        if (section.offsetTop <= container.scrollTop + 20) {
          nextIndex = Number(section.dataset.emojiGroupIndex || 0)
        } else {
          break
        }
      }
      activeGroupIndex.value = nextIndex
    }

    const getGroupIcon = (group: DiscourseEmojiGroup) =>
      group.icon || group.emojis[0]?.unicode || '📁'

    const clearRecent = () => {
      recentNames.value = []
      saveRecentNames()
      activeGroupIndex.value = 0
    }

    return () => {
      if (!props.visible) return null

      const displayGroups = filteredGroups.value
      const title = props.mode === 'shortcode' ? '插入站点表情短码' : '选择反应'

      return (
        <Teleport to="body">
          <div
            ref={pickerRef}
            class="discourse-emoji-picker"
            style={pickerStyle.value}
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
                    {modeGroups.value.map((group, index) => (
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
                        {group.icon ? (
                          <span aria-hidden="true">{group.icon}</span>
                        ) : group.emojis[0]?.url ? (
                          <img src={group.emojis[0].url} alt="" loading="lazy" />
                        ) : (
                          getGroupIcon(group)
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div class="discourse-emoji-picker__scrollable" onScroll={handleGroupScroll}>
                  {displayGroups.map((group, index) => (
                    <section
                      key={group.id}
                      class="discourse-emoji-picker__section"
                      data-emoji-group-index={index}
                      aria-label={group.name}
                    >
                      <div class="discourse-emoji-picker__section-title">
                        <h3>{group.name}</h3>
                        {group.id === 'recent' && (
                          <button
                            type="button"
                            title="清空近期使用"
                            aria-label="清空近期使用"
                            onClick={clearRecent}
                          >
                            🗑
                          </button>
                        )}
                      </div>
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
        </Teleport>
      )
    }
  }
})
