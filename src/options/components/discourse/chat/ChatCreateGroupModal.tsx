import { defineComponent, onBeforeUnmount, ref, watch } from 'vue'
import { Input, Spin } from 'ant-design-vue'
import { CloseOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons-vue'

import type { DiscourseUser } from '../types'
import { getAvatarUrl } from '../utils'
import '../css/chat/ChatCreateGroupModal.css'

const getChatUnavailableReason = (user: DiscourseUser, currentUsername?: string) => {
  if (currentUsername && user.username === currentUsername) return '不能与自己发起聊天'
  if (user.has_chat_enabled === false) return '对方已关闭聊天'
  if (user.can_chat === false || user.can_chat_user === false) return '当前无法与该用户聊天'
  if (user.can_chat !== true || user.has_chat_enabled !== true) return '无法确认对方的聊天权限'
  return ''
}

export default defineComponent({
  name: 'ChatCreateGroupModal',
  props: {
    open: { type: Boolean, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    searching: { type: Boolean, default: false },
    creating: { type: Boolean, default: false },
    searchResults: { type: Array as () => DiscourseUser[], default: () => [] }
  },
  emits: ['close', 'create', 'search'],
  setup(props, { emit }) {
    const query = ref('')
    const selected = ref<DiscourseUser[]>([])
    const groupName = ref('')
    let searchTimer: ReturnType<typeof setTimeout> | null = null

    watch(
      () => props.open,
      open => {
        if (!open) return
        query.value = ''
        selected.value = []
        groupName.value = ''
        emit('search', '')
      }
    )

    onBeforeUnmount(() => {
      if (searchTimer) clearTimeout(searchTimer)
    })

    const handleSearchInput = (value: string) => {
      query.value = value
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => emit('search', value.trim()), 300)
    }

    const toggleSelect = (user: DiscourseUser) => {
      if (getChatUnavailableReason(user, props.currentUsername)) return
      const index = selected.value.findIndex(item => item.id === user.id)
      selected.value =
        index === -1
          ? [...selected.value, user]
          : selected.value.filter(item => item.id !== user.id)
    }

    const isSelected = (user: DiscourseUser) => selected.value.some(item => item.id === user.id)

    const handleCreate = () => {
      if (selected.value.length === 0 || props.creating) return
      emit('create', {
        targetUsernames: selected.value.map(user => user.username),
        name: groupName.value.trim() || undefined
      })
    }

    return () => {
      if (!props.open) return null

      return (
        <div class="chat-group-modal">
          <div class="chat-group-modal__backdrop" onClick={() => emit('close')} />
          <section
            class="chat-group-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-label="发起聊天"
          >
            <div class="chat-group-modal__header">
              <div class="chat-group-modal__title">
                <UserAddOutlined /> 发起聊天
              </div>
              <button
                type="button"
                class="chat-group-modal__close"
                aria-label="关闭发起聊天窗口"
                disabled={props.creating}
                onClick={() => emit('close')}
              >
                <CloseOutlined />
              </button>
            </div>

            <div class="chat-group-modal__body">
              <label class="chat-group-modal__label" for="chat-create-group-name">
                聊天名称（多人聊天可选）
              </label>
              <Input
                id="chat-create-group-name"
                value={groupName.value}
                placeholder="例如：周末活动群"
                disabled={props.creating}
                onUpdate:value={(value: string) => (groupName.value = value)}
              />

              <label class="chat-group-modal__label" for="chat-create-user-search">
                搜索用户（可选择一人或多人）
              </label>
              <Input
                id="chat-create-user-search"
                value={query.value}
                placeholder="输入用户名搜索..."
                prefix={<SearchOutlined />}
                disabled={props.creating}
                onUpdate:value={handleSearchInput}
              />

              {selected.value.length > 0 && (
                <div class="chat-group-modal__selected" aria-label="已选用户">
                  {selected.value.map(user => (
                    <span key={user.id} class="chat-group-modal__selected-item">
                      <img
                        src={getAvatarUrl(user.avatar_template, props.baseUrl, 24)}
                        alt=""
                        data-user-card={user.username}
                      />
                      {user.username}
                      <button
                        type="button"
                        class="chat-group-modal__selected-remove"
                        aria-label={`移除 ${user.username}`}
                        disabled={props.creating}
                        onClick={() => toggleSelect(user)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div class="chat-group-modal__results" aria-live="polite">
                {props.searching && (
                  <div class="chat-group-modal__loading">
                    <Spin size="small" />
                  </div>
                )}
                {!props.searching &&
                  props.searchResults.map(user => {
                    const unavailableReason = getChatUnavailableReason(user, props.currentUsername)
                    return (
                      <button
                        key={user.id}
                        type="button"
                        class={[
                          'chat-group-modal__result',
                          isSelected(user) ? 'is-selected' : '',
                          unavailableReason ? 'is-disabled' : ''
                        ]}
                        disabled={!!unavailableReason || props.creating}
                        title={unavailableReason || `选择 ${user.username}`}
                        onClick={() => toggleSelect(user)}
                      >
                        <img
                          src={getAvatarUrl(user.avatar_template, props.baseUrl, 32)}
                          alt=""
                          class="chat-group-modal__result-avatar"
                          data-user-card={user.username}
                        />
                        <span class="chat-group-modal__result-identity">
                          <span class="chat-group-modal__result-name">
                            {user.name || user.username}
                          </span>
                          <span class="chat-group-modal__result-username">@{user.username}</span>
                        </span>
                        {unavailableReason && (
                          <span class="chat-group-modal__result-reason">{unavailableReason}</span>
                        )}
                      </button>
                    )
                  })}
                {!props.searching && query.value.trim() && props.searchResults.length === 0 && (
                  <div class="chat-group-modal__empty">未找到匹配的用户</div>
                )}
              </div>
            </div>

            <div class="chat-group-modal__footer">
              <button
                type="button"
                class="chat-group-modal__cancel"
                disabled={props.creating}
                onClick={() => emit('close')}
              >
                取消
              </button>
              <button
                type="button"
                class="chat-group-modal__create"
                disabled={selected.value.length === 0 || props.creating}
                onClick={handleCreate}
              >
                {props.creating ? <Spin size="small" /> : <UserAddOutlined />}
                {selected.value.length > 1 ? '创建群聊' : '创建聊天'}（{selected.value.length} 人）
              </button>
            </div>
          </section>
        </div>
      )
    }
  }
})
