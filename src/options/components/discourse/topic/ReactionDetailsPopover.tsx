import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { Spin } from 'ant-design-vue'

import type { DiscoursePost, DiscourseReactionUser } from '../types'
import { extractData, getAvatarUrl, pageFetch } from '../utils'

import '../css/ReactionDetailsPopover.css'

const PAGE_SIZE = 50

export default defineComponent({
  name: 'ReactionDetailsPopover',
  props: {
    open: { type: Boolean, required: true },
    post: { type: Object as () => DiscoursePost | null, default: null },
    reaction: { type: String as () => string | null, default: null },
    baseUrl: { type: String, required: true },
    anchorEl: { type: Object as () => HTMLElement | null, default: null },
    reactionEmojiMap: {
      type: Object as () => Record<string, { url?: string; unicode?: string }>,
      default: () => ({})
    }
  },
  emits: ['close', 'openUser', 'keepOpen'],
  setup(props, { emit }) {
    const users = ref<DiscourseReactionUser[]>([])
    const total = ref(0)
    const loading = ref(false)
    const errorMessage = ref('')
    const panelRef = ref<HTMLDivElement | null>(null)
    const panelStyle = ref<Record<string, string>>({})
    let loadSequence = 0

    const normalizeReaction = (reaction?: string | null) =>
      String(reaction || props.reaction || '')
        .replace(/^:([^:]+):$/, '$1')
        .trim()

    const title = computed(() =>
      props.reaction ? `:${normalizeReaction(props.reaction)}:` : '全部反应'
    )
    const groupedUsers = computed(() => {
      const groups = new Map<string, DiscourseReactionUser[]>()
      users.value.forEach(user => {
        const reaction = normalizeReaction(user.reaction)
        const group = groups.get(reaction) || []
        group.push(user)
        groups.set(reaction, group)
      })

      return [...groups.entries()]
        .map(([reaction, reactionUsers]) => ({ reaction, users: reactionUsers }))
        .sort((left, right) => {
          if (props.reaction) return 0
          return (
            right.users.length - left.users.length || left.reaction.localeCompare(right.reaction)
          )
        })
    })
    const loadedUsersCount = computed(() => users.value.length)
    const hasMoreResults = computed(() => total.value > loadedUsersCount.value)

    const load = async () => {
      if (!props.post) return
      const sequence = ++loadSequence
      loading.value = true
      errorMessage.value = ''
      try {
        const params = new URLSearchParams({ page: '0', limit: String(PAGE_SIZE) })
        if (props.reaction) params.set('reaction_value', props.reaction)
        const result = await pageFetch<any>(
          `${props.baseUrl}/discourse-reactions/posts/${props.post.id}/reactions-users-list.json?${params}`
        )
        const data = extractData(result)
        if (!result.ok) {
          throw new Error(data?.errors?.join(', ') || data?.error || '获取反应详情失败')
        }
        if (sequence !== loadSequence) return
        const incoming = Array.isArray(data?.users) ? data.users : []
        const byKey = new Map<string, DiscourseReactionUser>()
        incoming.forEach((user: any) => {
          if (!user?.username) return
          byKey.set(`${user.id || user.username}:${user.reaction || ''}`, user)
        })
        users.value = [...byKey.values()]
        total.value = Number(data?.total_rows ?? users.value.length) || users.value.length
      } catch (error) {
        if (sequence !== loadSequence) return
        errorMessage.value = error instanceof Error ? error.message : '获取反应详情失败'
      } finally {
        if (sequence === loadSequence) loading.value = false
      }
    }

    const updatePosition = () => {
      if (typeof window === 'undefined') return
      const padding = 12
      const gap = 8
      const width = Math.min(340, Math.max(260, window.innerWidth - padding * 2))
      const anchor = props.anchorEl?.getBoundingClientRect()

      let left = padding
      let top = padding
      if (anchor) {
        left = Math.max(padding, Math.min(anchor.left, window.innerWidth - width - padding))
        const roomAbove = anchor.top - padding - gap
        const roomBelow = window.innerHeight - anchor.bottom - padding - gap
        if (roomAbove >= 220 || roomAbove >= roomBelow) {
          top = Math.max(padding, anchor.top - 220 - gap)
        } else {
          top = Math.min(window.innerHeight - 220 - padding, anchor.bottom + gap)
        }
      }
      panelStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(width)}px`
      }
    }

    watch(
      () => [props.open, props.post?.id, props.reaction, props.anchorEl] as const,
      ([open]) => {
        if (open) {
          users.value = []
          total.value = 0
          void load()
          void nextTick(updatePosition)
        }
      },
      { immediate: true }
    )

    const renderReactionEmoji = (reaction: string | null) => {
      const id = normalizeReaction(reaction)
      const emoji = id ? props.reactionEmojiMap[id] : undefined
      if (emoji?.url) {
        return (
          <img class="reaction-details-popover__emoji" src={emoji.url} alt={id} loading="lazy" />
        )
      }
      if (emoji?.unicode) {
        return <span class="reaction-details-popover__emoji">{emoji.unicode}</span>
      }
      return id ? <code>:{id}:</code> : null
    }

    return () =>
      props.open ? (
        <div
          ref={panelRef}
          class="reaction-details-popover reaction-details-modal-wrap"
          style={panelStyle.value}
          role="dialog"
          aria-label={`${title.value} 反应详情`}
          onMouseenter={() => emit('keepOpen')}
          onMouseleave={() => emit('close')}
        >
          <button
            type="button"
            class="reaction-details-popover__close ant-modal-close"
            aria-label="关闭"
            title="关闭"
            onClick={() => emit('close')}
          >
            ×
          </button>
          <div class="reaction-details-popover__summary">
            <div class="reaction-details-popover__summary-title">
              {props.reaction && renderReactionEmoji(props.reaction)}
              <strong>{title.value}</strong>
            </div>
            <span>共 {total.value || users.value.length} 人次</span>
          </div>

          {loading.value && (
            <div class="reaction-details-popover__state" role="status">
              <Spin size="small" /> 正在加载…
            </div>
          )}
          {!loading.value && errorMessage.value && (
            <div class="reaction-details-popover__state is-error" role="alert">
              {errorMessage.value}
            </div>
          )}
          {!loading.value && !errorMessage.value && groupedUsers.value.length === 0 && (
            <div class="reaction-details-popover__state">暂无可显示的反应用户</div>
          )}

          {groupedUsers.value.length > 0 && (
            <div class="reaction-details-popover__list">
              {groupedUsers.value.map(group => (
                <section
                  key={group.reaction || 'unknown'}
                  class="reaction-details-popover__group"
                  aria-label={`${group.reaction ? `:${group.reaction}:` : '其他反应'}：${group.users.length} 人`}
                >
                  <header class="reaction-details-popover__group-heading">
                    <span class="reaction-details-popover__group-emoji">
                      {renderReactionEmoji(group.reaction || null)}
                    </span>
                    <strong>{group.reaction ? `:${group.reaction}:` : '其他反应'}</strong>
                    <span>{group.users.length} 人</span>
                  </header>
                  <div class="reaction-details-popover__group-users">
                    {group.users.map(user => (
                      <button
                        type="button"
                        key={`${user.id}-${user.reaction || group.reaction || ''}`}
                        class="reaction-details-popover__user"
                        data-user-card={user.username}
                        data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(user.username)}`}
                        onClick={() => emit('openUser', user.username)}
                      >
                        <img
                          src={getAvatarUrl(user.avatar_template, props.baseUrl, 40)}
                          alt=""
                          loading="lazy"
                        />
                        <span class="reaction-details-popover__identity">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {hasMoreResults.value && (
            <div class="reaction-details-popover__more">
              已显示前 {loadedUsersCount.value} 人，另有 {total.value - loadedUsersCount.value}{' '}
              人次…
            </div>
          )}
        </div>
      ) : null
  }
})
