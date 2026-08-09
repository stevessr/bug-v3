import { defineComponent, ref, watch } from 'vue'
import { Spin, Input } from 'ant-design-vue'
import { CloseOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons-vue'

import type { DiscourseUser } from '../types'
import { getAvatarUrl } from '../utils'
import '../css/chat/ChatCreateGroupModal.css'

export default defineComponent({
  name: 'ChatCreateGroupModal',
  props: {
    open: { type: Boolean, required: true },
    baseUrl: { type: String, required: true },
    searching: { type: Boolean, default: false },
    searchResults: { type: Array as () => DiscourseUser[], default: () => [] }
  },
  emits: ['close', 'create', 'search'],
  setup(props, { emit }) {
    const query = ref('')
    const selected = ref<DiscourseUser[]>([])
    const groupName = ref('')
    const creating = ref(false)

    watch(
      () => props.open,
      open => {
        if (open) {
          query.value = ''
          selected.value = []
          groupName.value = ''
        }
      }
    )

    let searchTimer: ReturnType<typeof setTimeout> | null = null

    const handleSearchInput = (value: string) => {
      query.value = value
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        const trimmed = value.trim()
        if (!trimmed) return
        emit('search', trimmed)
      }, 300)
    }

    const toggleSelect = (user: DiscourseUser) => {
      const index = selected.value.findIndex(u => u.id === user.id)
      if (index === -1) {
        selected.value = [...selected.value, user]
      } else {
        selected.value = selected.value.filter(u => u.id !== user.id)
      }
    }

    const isSelected = (user: DiscourseUser) =>
      selected.value.some(u => u.id === user.id)

    const handleCreate = () => {
      if (selected.value.length === 0 || creating.value) return
      creating.value = true
      emit('create', {
        targetUsernames: selected.value.map(u => u.username),
        name: groupName.value.trim() || undefined
      })
      creating.value = false
    }

    if (!props.open) {
      return () => null
    }

    return () => (
      <div class="chat-group-modal">
        <div class="chat-group-modal__backdrop" onClick={() => emit('close')} />
        <div class="chat-group-modal__panel">
          <div class="chat-group-modal__header">
            <div class="chat-group-modal__title">
              <UserAddOutlined /> 创建群聊
            </div>
            <button class="chat-group-modal__close" onClick={() => emit('close')}>
              <CloseOutlined />
            </button>
          </div>

          <div class="chat-group-modal__body">
            <label class="chat-group-modal__label">群聊名称（可选）</label>
            <Input
              value={groupName.value}
              placeholder="例如：周末活动群"
              onUpdate:value={(v: string) => (groupName.value = v)}
            />

            <label class="chat-group-modal__label">搜索用户（选择至少 2 人，将自动包含你自己）</label>
            <Input
              value={query.value}
              placeholder="输入用户名搜索..."
              prefix={<SearchOutlined />}
              onUpdate:value={handleSearchInput}
            />

            {selected.value.length > 0 && (
              <div class="chat-group-modal__selected">
                {selected.value.map(user => (
                  <span key={user.id} class="chat-group-modal__selected-item">
                    <img
                      src={getAvatarUrl(user.avatar_template, props.baseUrl, 24)}
                      alt={user.username}
                    />
                    {user.username}
                    <button
                      class="chat-group-modal__selected-remove"
                      onClick={() => toggleSelect(user)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div class="chat-group-modal__results">
              {props.searching && (
                <div class="chat-group-modal__loading">
                  <Spin size="small" />
                </div>
              )}
              {!props.searching &&
                props.searchResults.map(user => (
                  <button
                    key={user.id}
                    class={[
                      'chat-group-modal__result',
                      isSelected(user) ? 'is-selected' : ''
                    ]}
                    onClick={() => toggleSelect(user)}
                  >
                    <img
                      src={getAvatarUrl(user.avatar_template, props.baseUrl, 32)}
                      alt={user.username}
                      class="chat-group-modal__result-avatar"
                    />
                    <span class="chat-group-modal__result-name">
                      {user.name || user.username}
                    </span>
                    <span class="chat-group-modal__result-username">@{user.username}</span>
                  </button>
                ))}
              {!props.searching && query.value.trim() && props.searchResults.length === 0 && (
                <div class="chat-group-modal__empty">未找到匹配的用户</div>
              )}
            </div>
          </div>

          <div class="chat-group-modal__footer">
            <button class="chat-group-modal__cancel" onClick={() => emit('close')}>
              取消
            </button>
            <button
              class="chat-group-modal__create"
              disabled={selected.value.length === 0 || creating.value}
              onClick={handleCreate}
            >
              {creating.value ? <Spin size="small" /> : <UserAddOutlined />}
              创建群聊（{selected.value.length} 人）
            </button>
          </div>
        </div>
      </div>
    )
  }
})
