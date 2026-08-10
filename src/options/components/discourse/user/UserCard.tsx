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
import { message, Spin } from 'ant-design-vue'

import type { DiscourseUserProfile } from '../types'
import { fetchUserCard, setUserFollowed } from '../actions'
import { resolveDiscourseHttpUrl } from '../navigation'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import { getAvatarUrl } from '../utils'
import '../css/UserCard.css'

export interface UserCardAnchor {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

type CardUser = Partial<DiscourseUserProfile> &
  Pick<DiscourseUserProfile, 'id' | 'username' | 'avatar_template'>

export default defineComponent({
  name: 'UserCard',
  props: {
    open: { type: Boolean, required: true },
    username: { type: String, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: '' },
    anchor: { type: Object as PropType<UserCardAnchor | null>, default: null }
  },
  emits: ['close', 'openProfile', 'composeMessage', 'startChat'],
  setup(props, { emit }) {
    const cardRef = ref<HTMLElement | null>(null)
    const user = ref<CardUser | null>(null)
    const loading = ref(false)
    const errorMessage = ref('')
    const followSaving = ref(false)
    const cardStyle = ref<Record<string, string>>({})
    let loadSequence = 0

    const isSelf = computed(
      () =>
        !!props.currentUsername &&
        props.currentUsername.toLowerCase() === props.username.toLowerCase()
    )
    const canMessage = computed(
      () =>
        !isSelf.value &&
        Boolean(
          user.value?.can_send_private_message_to_user ?? user.value?.can_send_private_messages
        )
    )
    const canChat = computed(() => !isSelf.value && user.value?.can_chat_user === true)
    const canFollow = computed(
      () => !isSelf.value && Boolean(user.value?.can_follow || user.value?.is_followed)
    )
    const backgroundUrl = computed(() => {
      const raw = user.value?.card_background_upload_url
      return raw ? resolveDiscourseHttpUrl(raw, props.baseUrl) : ''
    })

    const updatePosition = () => {
      if (typeof window === 'undefined') return
      const padding = 12
      const gap = 8
      const width = Math.min(420, window.innerWidth - padding * 2)
      const estimatedHeight = Math.min(430, window.innerHeight - padding * 2)
      const anchor = props.anchor
      let left = anchor ? anchor.left : (window.innerWidth - width) / 2
      let top = anchor ? anchor.bottom + gap : (window.innerHeight - estimatedHeight) / 2

      if (anchor && top + estimatedHeight > window.innerHeight - padding) {
        top = anchor.top - estimatedHeight - gap
      }
      left = Math.max(padding, Math.min(left, window.innerWidth - width - padding))
      top = Math.max(padding, Math.min(top, window.innerHeight - estimatedHeight - padding))
      cardStyle.value = {
        width: `${Math.round(width)}px`,
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`
      }
    }

    const load = async () => {
      const sequence = ++loadSequence
      loading.value = true
      errorMessage.value = ''
      user.value = null
      try {
        const data = await fetchUserCard(props.baseUrl, props.username)
        if (sequence !== loadSequence) return
        user.value = data as CardUser
      } catch (error) {
        if (sequence !== loadSequence) return
        errorMessage.value = error instanceof Error ? error.message : '加载用户卡片失败'
      } finally {
        if (sequence === loadSequence) loading.value = false
      }
    }

    const handleOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-user-card]')) return
      if (target instanceof Node && !cardRef.value?.contains(target)) emit('close')
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') emit('close')
    }

    const removeListeners = () => {
      document.removeEventListener('pointerdown', handleOutside, true)
      document.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    }

    watch(
      () => [props.open, props.username, props.baseUrl] as const,
      ([open]) => {
        removeListeners()
        if (!open || !props.username) return
        updatePosition()
        void load()
        void nextTick(updatePosition)
        document.addEventListener('pointerdown', handleOutside, true)
        document.addEventListener('keydown', handleKeydown)
        window.addEventListener('resize', updatePosition)
        document.addEventListener('scroll', updatePosition, true)
      },
      { immediate: true }
    )

    watch(
      () => props.anchor,
      () => {
        if (props.open) void nextTick(updatePosition)
      }
    )

    onBeforeUnmount(removeListeners)

    const toggleFollow = async () => {
      if (!user.value || followSaving.value) return
      const next = !user.value.is_followed
      followSaving.value = true
      try {
        await setUserFollowed(props.baseUrl, user.value.username, next)
        user.value.is_followed = next
        const count = Number(user.value.total_followers || 0)
        user.value.total_followers = Math.max(0, count + (next ? 1 : -1))
        message.success(next ? '已关注' : '已取消关注')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '关注操作失败')
      } finally {
        followSaving.value = false
      }
    }

    return () => {
      if (!props.open) return null
      return (
        <Teleport to="body">
          <section
            ref={cardRef}
            class="discourse-user-card"
            style={cardStyle.value}
            role="dialog"
            aria-label={`${props.username} 的用户卡片`}
          >
            {loading.value ? (
              <div class="discourse-user-card__state" role="status">
                <Spin />
                <span>加载用户卡片…</span>
              </div>
            ) : errorMessage.value || !user.value ? (
              <div class="discourse-user-card__state is-error">
                <span>{errorMessage.value || '用户不存在'}</span>
                <button type="button" onClick={() => void load()}>
                  重试
                </button>
              </div>
            ) : (
              <>
                <div
                  class="discourse-user-card__cover"
                  style={
                    backgroundUrl.value
                      ? {
                          backgroundImage: `url("${backgroundUrl.value.replace(/"/g, '%22')}")`
                        }
                      : undefined
                  }
                />
                <div class="discourse-user-card__body">
                  <button
                    type="button"
                    class="discourse-user-card__avatar-button"
                    aria-label="打开用户主页"
                    onClick={() => emit('openProfile', user.value?.username)}
                  >
                    <img
                      src={getAvatarUrl(user.value.avatar_template, props.baseUrl, 96)}
                      alt={user.value.username}
                      class="discourse-user-card__avatar"
                    />
                  </button>
                  <div class="discourse-user-card__identity">
                    <button
                      type="button"
                      class="discourse-user-card__username"
                      onClick={() => emit('openProfile', user.value?.username)}
                    >
                      {user.value.username}
                    </button>
                    {user.value.name && <span>{user.value.name}</span>}
                    {user.value.title && <small>{user.value.title}</small>}
                  </div>
                  <button
                    type="button"
                    class="discourse-user-card__close"
                    aria-label="关闭用户卡片"
                    onClick={() => emit('close')}
                  >
                    ×
                  </button>

                  {user.value.status && (
                    <div class="discourse-user-card__status">
                      <span>{user.value.status.emoji}</span>
                      <span>{user.value.status.description}</span>
                    </div>
                  )}

                  {(user.value.bio_cooked || user.value.bio_excerpt) && (
                    <div
                      class="discourse-user-card__bio"
                      innerHTML={sanitizeDiscourseHtml(
                        user.value.bio_cooked || user.value.bio_excerpt || ''
                      )}
                    />
                  )}

                  <div class="discourse-user-card__metadata">
                    {user.value.location && <span>📍 {user.value.location}</span>}
                    {user.value.website && (
                      <a href={user.value.website} target="_blank" rel="noopener noreferrer">
                        🔗 {user.value.website_name || user.value.website}
                      </a>
                    )}
                  </div>

                  {(user.value.total_followers !== undefined ||
                    user.value.total_following !== undefined) && (
                    <div class="discourse-user-card__stats">
                      <span>
                        <strong>{Number(user.value.total_followers || 0)}</strong> 关注者
                      </span>
                      <span>
                        <strong>{Number(user.value.total_following || 0)}</strong> 正在关注
                      </span>
                    </div>
                  )}

                  <div class="discourse-user-card__actions">
                    <button type="button" onClick={() => emit('openProfile', user.value?.username)}>
                      主页
                    </button>
                    {canMessage.value && (
                      <button
                        type="button"
                        onClick={() => emit('composeMessage', user.value?.username)}
                      >
                        私信
                      </button>
                    )}
                    {canChat.value && (
                      <button type="button" onClick={() => emit('startChat', user.value?.username)}>
                        聊天
                      </button>
                    )}
                    {canFollow.value && (
                      <button
                        type="button"
                        class={user.value.is_followed ? 'is-following' : ''}
                        disabled={followSaving.value}
                        onClick={() => void toggleFollow()}
                      >
                        {followSaving.value
                          ? '处理中…'
                          : user.value.is_followed
                            ? '已关注'
                            : '关注'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </Teleport>
      )
    }
  }
})
