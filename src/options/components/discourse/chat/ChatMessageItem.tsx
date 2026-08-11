import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  FlagOutlined,
  ForwardOutlined,
  CommentOutlined
} from '@ant-design/icons-vue'

import type { ChatMessage, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import { fetchDiscourseEmojiGroups } from '../linux.do/emojis'
import PostContent from '../topic/PostContent'

import ChatEmojiPicker from './ChatEmojiPicker'
import '../css/chat/ChatMessageItem.css'

export default defineComponent({
  name: 'ChatMessageItem',
  props: {
    message: { type: Object as () => ChatMessage, required: true },
    parsed: { type: Object as () => ParsedContent, required: true },
    baseUrl: { type: String, required: true },
    channelId: { type: Number, default: undefined },
    isOwn: { type: Boolean, required: true },
    highlighted: { type: Boolean, default: false },
    threadingEnabled: { type: Boolean, default: false },
    inThread: { type: Boolean, default: false },
    groupFirst: { type: Boolean, default: true },
    groupLast: { type: Boolean, default: true }
  },
  emits: ['navigate', 'react', 'interact', 'reply', 'openThread', 'edit', 'delete', 'flag'],
  setup(props, { emit }) {
    const showActions = ref(false)
    const showEmojiPicker = ref(false)
    const floatingControlsRef = ref<HTMLDivElement | null>(null)
    const reactionButtonRef = ref<HTMLButtonElement | null>(null)
    const actionsToggleRef = ref<HTMLButtonElement | null>(null)

    // 站点表情映射：把短码反应渲染为表情图片（任意表情反应）
    const emojiMap = ref<Record<string, { url?: string; unicode?: string }>>({})
    const loadEmojiMap = async () => {
      try {
        const groups = await fetchDiscourseEmojiGroups(props.baseUrl)
        const map: Record<string, { url?: string; unicode?: string }> = {}
        groups.forEach(group => {
          group.emojis.forEach(emoji => {
            const value = { url: emoji.url || undefined, unicode: emoji.unicode }
            map[emoji.name] = value
            map[emoji.id] = value
          })
        })
        emojiMap.value = map
      } catch {
        // 表情加载失败时回退为文本短码展示
      }
    }
    onMounted(loadEmojiMap)

    const resolveReactionEmoji = (raw: string) => {
      const shortcode = String(raw || '').replace(/^:+|:+$/g, '')
      if (!shortcode) return null
      return emojiMap.value[shortcode] || null
    }

    const getDisplayName = () => {
      const user = props.message.user
      return user?.name || props.message.name || user?.username || props.message.username || '匿名'
    }

    const getUsername = () => props.message.user?.username || props.message.username || ''

    const getAvatarTemplate = () => {
      return (
        props.message.user?.avatar_template || props.message.avatar_template || '/images/avatar.png'
      )
    }

    const reactionItems = computed(() =>
      Array.isArray(props.message.reactions) ? props.message.reactions : []
    )

    const threadReplyCount = computed(() =>
      Math.max(
        0,
        Number(props.message.thread?.reply_count || props.message.thread?.preview?.reply_count || 0)
      )
    )

    const threadParticipants = computed(() =>
      (props.message.thread?.preview?.participant_users || []).slice(0, 3)
    )

    const hasThreadAction = computed(
      () =>
        !props.inThread &&
        Boolean(props.threadingEnabled || props.message.thread?.force || props.message.thread?.id)
    )

    const blockButtons = computed(() => {
      if (!Array.isArray(props.message.blocks)) return []
      const buttons: Array<{ actionId: string; label: string; style?: string }> = []
      props.message.blocks.forEach(block => {
        if (Array.isArray(block.elements)) {
          block.elements.forEach(element => {
            if (element.action_id && element.text?.text) {
              buttons.push({
                actionId: element.action_id,
                label: element.text.text,
                style: element.style
              })
            }
          })
        }
      })
      return buttons
    })

    const formatReactionLabel = (emoji: string) => {
      if (/^:[a-zA-Z0-9_+-]+:$/.test(emoji)) {
        return emoji.replace(/:/g, '')
      }
      return emoji
    }

    const normalizeReactionValue = (emoji: string) => emoji.trim().replace(/^:([^:]+):$/, '$1')

    const handleReact = (emoji: string, reacted?: boolean) => {
      emit('react', { messageId: props.message.id, emoji, reacted })
      showEmojiPicker.value = false
    }

    const handleAddReaction = () => {
      showEmojiPicker.value = !showEmojiPicker.value
      showActions.value = false
    }

    const handleEmojiSelect = (emoji: string) => {
      const normalized = normalizeReactionValue(emoji)
      const existing = reactionItems.value.find(
        reaction => normalizeReactionValue(reaction.emoji) === normalized
      )
      handleReact(emoji, existing?.reacted || false)
    }

    const handleInteract = (actionId: string) => {
      emit('interact', { messageId: props.message.id, actionId })
    }

    const toggleActions = () => {
      showActions.value = !showActions.value
      showEmojiPicker.value = false
    }

    const closeFloatingControls = () => {
      showActions.value = false
      showEmojiPicker.value = false
    }

    const handleMouseleave = (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && floatingControlsRef.value?.contains(relatedTarget)) {
        return
      }
      closeFloatingControls()
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.discourse-emoji-picker')) return
      const insideControls =
        target instanceof Node &&
        !!(floatingControlsRef.value?.contains(target) || actionsToggleRef.value?.contains(target))
      if (!insideControls) {
        closeFloatingControls()
      }
    }

    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFloatingControls()
      }
    }

    const handleControlsFocusout = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && floatingControlsRef.value?.contains(nextTarget)) return
      if (nextTarget instanceof Node && actionsToggleRef.value?.contains(nextTarget)) return
      closeFloatingControls()
    }

    const removeDismissListeners = () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      document.removeEventListener('keydown', handleDocumentKeydown)
    }

    watch(
      () => showActions.value || showEmojiPicker.value,
      open => {
        removeDismissListeners()
        if (open) {
          document.addEventListener('pointerdown', handleDocumentPointerDown, true)
          document.addEventListener('keydown', handleDocumentKeydown)
        }
      },
      { flush: 'sync' }
    )

    onBeforeUnmount(removeDismissListeners)

    const handleReply = () => {
      if (hasThreadAction.value) {
        emit('openThread', props.message)
      } else {
        emit('reply', props.message)
      }
      showActions.value = false
    }

    const handleOpenThread = () => {
      emit('openThread', props.message)
      closeFloatingControls()
    }

    const handleEdit = () => {
      emit('edit', props.message)
      showActions.value = false
    }

    const handleDelete = () => {
      emit('delete', props.message)
      showActions.value = false
    }

    const handleFlag = () => {
      emit('flag', props.message)
      showActions.value = false
    }

    // If deleted, render placeholder
    if (props.message.deleted) {
      return (
        <div
          class={[
            'chat-message-item',
            props.isOwn ? 'chat-message-own' : '',
            props.groupFirst ? '' : 'is-grouped-message group-follow',
            'is-deleted',
            props.highlighted ? 'is-search-target' : ''
          ]}
          data-chat-message-id={props.message.id}
        >
          <img
            class="chat-message-avatar"
            data-user-card={getUsername() || undefined}
            src={getAvatarUrl(getAvatarTemplate(), props.baseUrl, 32)}
            alt={getDisplayName()}
          />
          <div class="chat-message-content">
            <div class="chat-message-meta">
              {props.groupFirst && <span class="chat-message-name">{getDisplayName()}</span>}
            </div>
            <div class="chat-message-deleted-text">该消息已被删除</div>
          </div>
          <span class="chat-message-time-side">{formatTime(props.message.created_at)}</span>
        </div>
      )
    }

    return () => (
      <div
        class={[
          'chat-message-item',
          props.isOwn ? 'chat-message-own' : '',
          props.groupFirst ? '' : 'is-grouped-message group-follow',
          props.highlighted ? 'is-search-target' : '',
          showActions.value || showEmojiPicker.value ? 'has-floating-controls' : ''
        ]}
        data-chat-message-id={props.message.id}
        onMouseleave={handleMouseleave}
      >
        <img
          class="chat-message-avatar"
          data-user-card={getUsername() || undefined}
          src={getAvatarUrl(getAvatarTemplate(), props.baseUrl, 32)}
          alt={getDisplayName()}
        />
        <div class="chat-message-content">
          {props.groupFirst && (
            <div class="chat-message-meta">
              <span class="chat-message-name">{getDisplayName()}</span>
            </div>
          )}

          {props.message.cooked || props.message.message ? (
            <PostContent
              segments={props.parsed.segments}
              baseUrl={props.baseUrl}
              onNavigate={(url: string) => emit('navigate', url)}
            />
          ) : null}

          {!props.inThread && props.message.thread?.id && threadReplyCount.value > 0 && (
            <a
              class="chat-message-thread-indicator"
              href={`${props.baseUrl}/chat/c/-/${props.channelId || props.message.chat_channel_id}/t/${props.message.thread.id}`}
              aria-label={`打开消息串，共 ${threadReplyCount.value} 条回复`}
              title="打开消息串"
              onClick={(event: MouseEvent) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                handleOpenThread()
              }}
            >
              <span class="chat-message-thread-indicator__icon" aria-hidden="true">
                <CommentOutlined />
              </span>
              {threadParticipants.value.length > 0 && (
                <span class="chat-message-thread-indicator__participants" aria-hidden="true">
                  {threadParticipants.value.map(user => (
                    <img
                      key={user.id}
                      src={getAvatarUrl(user.avatar_template, props.baseUrl, 20)}
                      alt=""
                    />
                  ))}
                </span>
              )}
              <span class="chat-message-thread-indicator__count">
                {threadReplyCount.value} 条回复
              </span>
              {props.message.thread.preview?.last_reply_excerpt && (
                <span class="chat-message-thread-indicator__excerpt">
                  {props.message.thread.preview.last_reply_excerpt.replace(/<[^>]*>/g, '')}
                </span>
              )}
            </a>
          )}

          <div class="chat-message-footer">
            {reactionItems.value.map(reaction => {
              const resolvedEmoji = resolveReactionEmoji(reaction.emoji)
              return (
                <button
                  type="button"
                  key={`${props.message.id}-${reaction.emoji}`}
                  class={['chat-message-reaction', reaction.reacted ? 'active' : '']}
                  onClick={() => handleReact(reaction.emoji, reaction.reacted)}
                  title={reaction.emoji}
                >
                  <span class="chat-message-reaction-emoji">
                    {resolvedEmoji?.url ? (
                      <img
                        class="chat-message-reaction-image"
                        src={resolvedEmoji.url}
                        alt={formatReactionLabel(reaction.emoji)}
                        loading="lazy"
                      />
                    ) : resolvedEmoji?.unicode ? (
                      resolvedEmoji.unicode
                    ) : (
                      formatReactionLabel(reaction.emoji)
                    )}
                  </span>
                  <span class="chat-message-reaction-count">{reaction.count}</span>
                </button>
              )
            })}
            <div
              ref={floatingControlsRef}
              class="chat-message-reaction-actions"
              onFocusout={handleControlsFocusout}
            >
              <button
                ref={reactionButtonRef}
                type="button"
                class="chat-message-reaction-add"
                title="添加反应"
                onClick={handleAddReaction}
                aria-label="添加消息反应"
                aria-expanded={showEmojiPicker.value}
              >
                +
              </button>
              <ChatEmojiPicker
                visible={showEmojiPicker.value}
                baseUrl={props.baseUrl}
                allowAnyEmoji
                anchorEl={reactionButtonRef.value}
                onSelect={handleEmojiSelect}
                onClose={() => {
                  showEmojiPicker.value = false
                }}
              />
              {showActions.value && (
                <div class="chat-message-actions-menu" role="menu" aria-label="消息操作">
                  <button
                    type="button"
                    class="chat-message-actions-item"
                    role="menuitem"
                    onClick={handleReply}
                  >
                    {hasThreadAction.value ? <CommentOutlined /> : <ForwardOutlined />}
                    {hasThreadAction.value
                      ? props.message.thread?.id
                        ? '打开消息串'
                        : '在消息串中回复'
                      : '回复'}
                  </button>
                  {props.isOwn && (
                    <button
                      type="button"
                      class="chat-message-actions-item"
                      role="menuitem"
                      onClick={handleEdit}
                    >
                      <EditOutlined /> 编辑
                    </button>
                  )}
                  {props.isOwn && (
                    <button
                      type="button"
                      class="chat-message-actions-item is-danger"
                      role="menuitem"
                      onClick={handleDelete}
                    >
                      <DeleteOutlined /> 删除
                    </button>
                  )}
                  {!props.isOwn && (
                    <button
                      type="button"
                      class="chat-message-actions-item is-danger"
                      role="menuitem"
                      onClick={handleFlag}
                    >
                      <FlagOutlined /> 举报
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {blockButtons.value.length > 0 && (
            <div class="chat-message-blocks">
              {blockButtons.value.map((button, index) => (
                <button
                  type="button"
                  key={`${button.actionId}-${index}`}
                  class={['chat-message-block-button', button.style ? `is-${button.style}` : '']}
                  onClick={() => handleInteract(button.actionId)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          ref={actionsToggleRef}
          type="button"
          class="chat-message-actions-toggle"
          title="更多操作"
          onClick={toggleActions}
          aria-label="更多消息操作"
          aria-haspopup="menu"
          aria-expanded={showActions.value}
        >
          <MoreOutlined />
        </button>
        <span class="chat-message-time-side">
          {props.message.edited && <span class="chat-message-edited">已编辑</span>}
          {formatTime(props.message.created_at)}
        </span>
      </div>
    )
  }
})
