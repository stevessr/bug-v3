import { defineComponent, ref, computed, watch } from 'vue'
import { Spin, Input } from 'ant-design-vue'
import {
  CloseOutlined,
  SearchOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  BellOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'

import type { ChatChannel, ChatMember, DiscourseUser } from '../types'
import { getAvatarUrl } from '../utils'
import '../css/chat/ChatChannelManageModal.css'

export default defineComponent({
  name: 'ChatChannelManageModal',
  props: {
    open: { type: Boolean, required: true },
    channel: { type: Object as () => ChatChannel | null, default: null },
    members: { type: Array as () => ChatMember[], default: () => [] },
    membersTotal: { type: Number, default: 0 },
    membersLoading: { type: Boolean, default: false },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    searchResults: { type: Array as () => DiscourseUser[], default: () => [] },
    searching: { type: Boolean, default: false }
  },
  emits: [
    'close',
    'loadMembers',
    'addMembers',
    'removeMember',
    'follow',
    'unfollow',
    'deleteChannel',
    'search'
  ],
  setup(props, { emit }) {
    const channel = computed(() => props.channel)
    const query = ref('')
    const showAddForm = ref(false)
    const removingId = ref<number | null>(null)

    const canModerate = computed(() => !!channel.value?.meta?.can_moderate)
    const isDirect = computed(
      () =>
        channel.value?.channelType === 'direct' ||
        channel.value?.chatable_type === 'DirectMessage' ||
        !!channel.value?.chatable?.users?.length
    )
    const isMuted = computed(() => !!channel.value?.current_user_membership?.muted)

    watch(
      () => props.open,
      open => {
        if (open) {
          query.value = ''
          showAddForm.value = false
          if (channel.value?.id) {
            emit('loadMembers', channel.value.id)
          }
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

    const handleAdd = () => {
      const usernames = props.searchResults
        .filter(user => !props.members.some(member => member.user.id === user.id))
        .map(user => user.username)
      if (usernames.length === 0 || !channel.value) return
      emit('addMembers', { channelId: channel.value.id, usernames })
      showAddForm.value = false
      query.value = ''
    }

    const handleRemove = (member: ChatMember) => {
      if (!channel.value || removingId.value !== null) return
      removingId.value = member.user.id
      emit('removeMember', { channelId: channel.value.id, userId: member.user.id })
      removingId.value = null
    }

    const displayMembers = computed(() => {
      if (!props.members.length && !props.membersLoading && channel.value?.chatable?.users?.length) {
        return channel.value.chatable.users.map(user => ({
          id: user.id,
          user
        })) as ChatMember[]
      }
      return props.members
    })

    if (!props.open || !channel.value) {
      return () => null
    }

    const activeChannel = channel.value

    return () => (
      <div class="chat-manage-modal">
        <div class="chat-manage-modal__backdrop" onClick={() => emit('close')} />
        <div class="chat-manage-modal__panel">
          <div class="chat-manage-modal__header">
            <div class="chat-manage-modal__title">
              {activeChannel.title ||
                activeChannel.chatable?.name ||
                `频道 ${activeChannel.id}`}
              <span class="chat-manage-modal__type">
                {isDirect.value ? '直接消息' : '频道'}
              </span>
            </div>
            <button class="chat-manage-modal__close" onClick={() => emit('close')}>
              <CloseOutlined />
            </button>
          </div>

          <div class="chat-manage-modal__body">
            <div class="chat-manage-modal__section-title">
              成员（{props.membersTotal || displayMembers.value.length}）
            </div>

            <div class="chat-manage-modal__member-list">
              {props.membersLoading && displayMembers.value.length === 0 && (
                <div class="chat-manage-modal__loading">
                  <Spin size="small" />
                </div>
              )}
              {displayMembers.value.map(member => (
                <div key={member.user.id} class="chat-manage-modal__member">
                  <img
                    src={getAvatarUrl(member.user.avatar_template, props.baseUrl, 32)}
                    alt={member.user.username}
                    class="chat-manage-modal__member-avatar"
                  />
                  <div class="chat-manage-modal__member-info">
                    <span class="chat-manage-modal__member-name">
                      {member.user.name || member.user.username}
                      {member.user.username === props.currentUsername && (
                        <span class="chat-manage-modal__you">（我）</span>
                      )}
                    </span>
                    <span class="chat-manage-modal__member-username">@{member.user.username}</span>
                  </div>
                  {canModerate.value &&
                    member.user.username !== props.currentUsername &&
                    !isDirect.value && (
                      <button
                        class="chat-manage-modal__remove"
                        title="移除成员"
                        disabled={removingId.value === member.user.id}
                        onClick={() => handleRemove(member)}
                      >
                        <UserDeleteOutlined />
                      </button>
                    )}
                </div>
              ))}
            </div>

            {canModerate.value && !isDirect.value && (
              <div class="chat-manage-modal__add-section">
                {!showAddForm.value ? (
                  <button class="chat-manage-modal__add-btn" onClick={() => (showAddForm.value = true)}>
                    <UserAddOutlined /> 添加成员
                  </button>
                ) : (
                  <div class="chat-manage-modal__add-form">
                    <Input
                      value={query.value}
                      placeholder="搜索用户添加..."
                      prefix={<SearchOutlined />}
                      onUpdate:value={handleSearchInput}
                    />
                    <div class="chat-manage-modal__add-results">
                      {props.searching && (
                        <div class="chat-manage-modal__loading">
                          <Spin size="small" />
                        </div>
                      )}
                      {!props.searching &&
                        props.searchResults
                          .filter(user => !props.members.some(member => member.user.id === user.id))
                          .map(user => (
                            <button
                              key={user.id}
                              class="chat-manage-modal__add-result"
                              onClick={() => handleAdd()}
                            >
                              <img
                                src={getAvatarUrl(user.avatar_template, props.baseUrl, 24)}
                                alt={user.username}
                              />
                              <span>@{user.username}</span>
                              <UserAddOutlined />
                            </button>
                          ))}
                      {!props.searching &&
                        query.value.trim() &&
                        props.searchResults.filter(user =>
                          props.members.some(member => member.user.id === user.id)
                        ).length === props.searchResults.length &&
                        props.searchResults.length > 0 && (
                          <div class="chat-manage-modal__hint">以上用户已在群中</div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div class="chat-manage-modal__settings">
              <button
                class="chat-manage-modal__setting-btn"
                onClick={() =>
                  isMuted.value
                    ? emit('follow', activeChannel.id)
                    : emit('unfollow', activeChannel.id)
                }
              >
                {isMuted.value ? <BellOutlined /> : <BellOutlined />}
                {isMuted.value ? '恢复关注' : '静音频道'}
              </button>

              {canModerate.value && !isDirect.value && (
                <button
                  class="chat-manage-modal__setting-btn is-danger"
                  onClick={() => emit('deleteChannel', activeChannel.id)}
                >
                  <DeleteOutlined /> 删除频道
                </button>
              )}
            </div>
          </div>

          <div class="chat-manage-modal__footer">
            <button class="chat-manage-modal__done" onClick={() => emit('close')}>
              完成
            </button>
          </div>
        </div>
      </div>
    )
  }
})
