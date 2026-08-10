import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Input, Spin } from 'ant-design-vue'
import {
  CloseOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  WarningOutlined
} from '@ant-design/icons-vue'

import type { ChatChannel, ChatMember, DiscourseUser } from '../types'
import { getAvatarUrl } from '../utils'

import ChatChannelSettingsPanel from './ChatChannelSettingsPanel'
import '../css/chat/ChatChannelManageModal.css'

type ManageTab = 'settings' | 'members' | 'info'

const formatValue = (value: unknown): string => {
  if (value === true) return '是'
  if (value === false) return '否'
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join('、') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

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
    searching: { type: Boolean, default: false },
    savingChannel: { type: Boolean, default: false },
    savingMembership: { type: Boolean, default: false },
    savingStatus: { type: Boolean, default: false },
    savingFollow: { type: Boolean, default: false },
    leavingChannel: { type: Boolean, default: false },
    deletingChannel: { type: Boolean, default: false }
  },
  emits: [
    'close',
    'loadMembers',
    'addMembers',
    'removeMember',
    'follow',
    'unfollow',
    'updateChannel',
    'updateMembership',
    'updateStatus',
    'leaveChannel',
    'deleteChannel',
    'search'
  ],
  setup(props, { emit }) {
    const channel = computed(() => props.channel)
    const activeTab = ref<ManageTab>('settings')
    const query = ref('')
    const showAddForm = ref(false)
    const removingId = ref<number | null>(null)
    const panelRef = ref<HTMLElement | null>(null)

    const canModerate = computed(() => {
      const meta = channel.value?.meta
      return Boolean(meta?.can_moderate || meta?.can_manage)
    })
    const canManageMembers = computed(() => {
      const meta = channel.value?.meta
      return Boolean(meta?.can_moderate || meta?.can_remove_members || meta?.can_manage)
    })
    const isDirect = computed(
      () =>
        channel.value?.channelType === 'direct' ||
        channel.value?.chatable_type === 'DirectMessage' ||
        !!channel.value?.chatable?.users?.length
    )
    const hasMembership = computed(() => !!channel.value?.current_user_membership)

    const displayMembers = computed(() => {
      if (
        !props.members.length &&
        !props.membersLoading &&
        channel.value?.chatable?.users?.length
      ) {
        return channel.value.chatable.users.map(user => ({ id: user.id, user })) as ChatMember[]
      }
      return props.members
    })

    const memberCount = computed(
      () => props.membersTotal || channel.value?.memberships_count || displayMembers.value.length
    )

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') emit('close')
    }

    const resetModal = () => {
      activeTab.value = 'settings'
      query.value = ''
      showAddForm.value = false
      removingId.value = null
    }

    watch(
      () => props.open,
      open => {
        document.removeEventListener('keydown', handleKeydown)
        if (!open) return
        resetModal()
        document.addEventListener('keydown', handleKeydown)
        if (channel.value?.id) emit('loadMembers', channel.value.id)
        void nextTick(() => panelRef.value?.focus())
      }
    )

    watch(
      () => props.channel?.id,
      channelId => {
        if (!props.open || !channelId) return
        resetModal()
        emit('loadMembers', channelId)
      }
    )

    let searchTimer: ReturnType<typeof setTimeout> | null = null
    onBeforeUnmount(() => {
      if (searchTimer) clearTimeout(searchTimer)
      document.removeEventListener('keydown', handleKeydown)
    })

    const selectTab = (tab: ManageTab) => {
      activeTab.value = tab
      if (tab === 'members' && channel.value?.id) emit('loadMembers', channel.value.id)
    }

    const handleSearchInput = (value: string) => {
      query.value = value
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        const trimmed = value.trim()
        if (trimmed) emit('search', trimmed)
      }, 300)
    }

    const handleAdd = (user: DiscourseUser) => {
      if (!channel.value || props.members.some(member => member.user.id === user.id)) return
      emit('addMembers', { channelId: channel.value.id, usernames: [user.username] })
      showAddForm.value = false
      query.value = ''
    }

    const handleRemove = (member: ChatMember) => {
      if (!channel.value || removingId.value !== null) return
      removingId.value = member.user.id
      emit('removeMember', { channelId: channel.value.id, userId: member.user.id })
      removingId.value = null
    }

    const renderMembers = () => (
      <section class="chat-manage-members" aria-labelledby="chat-members-title">
        <div class="chat-manage-modal__section-heading">
          <div>
            <h3 id="chat-members-title" class="chat-manage-modal__section-title">
              频道成员
            </h3>
            <div class="chat-manage-modal__section-caption">
              已显示 {displayMembers.value.length} / {memberCount.value} 人
            </div>
          </div>
          {canManageMembers.value && !isDirect.value && (
            <button
              type="button"
              class="chat-manage-modal__add-btn"
              aria-label="添加成员"
              onClick={() => (showAddForm.value = !showAddForm.value)}
            >
              <UserAddOutlined /> 添加成员
            </button>
          )}
        </div>

        {showAddForm.value && canManageMembers.value && !isDirect.value && (
          <div class="chat-manage-modal__add-form">
            <Input
              value={query.value}
              placeholder="搜索用户添加…"
              prefix={<SearchOutlined />}
              allowClear
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
                      type="button"
                      class="chat-manage-modal__add-result"
                      onClick={() => handleAdd(user)}
                    >
                      <img src={getAvatarUrl(user.avatar_template, props.baseUrl, 24)} alt="" />
                      <span>
                        <strong>{user.name || user.username}</strong>
                        <small>@{user.username}</small>
                      </span>
                      <UserAddOutlined />
                    </button>
                  ))}
              {!props.searching && query.value.trim() && props.searchResults.length === 0 && (
                <div class="chat-manage-modal__hint">未找到匹配的用户</div>
              )}
            </div>
          </div>
        )}

        <div class="chat-manage-modal__member-list">
          {props.membersLoading && displayMembers.value.length === 0 && (
            <div class="chat-manage-modal__loading">
              <Spin size="small" />
            </div>
          )}
          {!props.membersLoading && displayMembers.value.length === 0 && (
            <div class="chat-manage-modal__empty">暂无可显示的成员</div>
          )}
          {displayMembers.value.map(member => (
            <div key={member.user.id} class="chat-manage-modal__member">
              <img
                src={getAvatarUrl(member.user.avatar_template, props.baseUrl, 40)}
                alt=""
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
              {canManageMembers.value &&
                member.user.username !== props.currentUsername &&
                !isDirect.value && (
                  <button
                    type="button"
                    class="chat-manage-modal__remove"
                    aria-label={`移除 ${member.user.username}`}
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
      </section>
    )

    const renderInfoGroup = (title: string, rows: Array<[string, unknown]>, id: string) => (
      <section class="chat-channel-info" aria-labelledby={id}>
        <h3 id={id} class="chat-manage-modal__section-title">
          {title}
        </h3>
        <dl class="chat-channel-info__grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd title={formatValue(value)}>{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    )

    const renderInfo = (activeChannel: ChatChannel) => {
      const membership = activeChannel.current_user_membership
      const permissionRows = Object.entries(activeChannel.meta || {}).sort(([a], [b]) =>
        a.localeCompare(b)
      )

      return (
        <div class="chat-channel-info-list">
          {renderInfoGroup(
            '频道标识',
            [
              ['ID', activeChannel.id],
              ['标题', activeChannel.title || activeChannel.unicode_title],
              ['Slug', activeChannel.slug],
              ['表情', activeChannel.emoji || activeChannel.chatable?.emoji],
              ['频道类型', activeChannel.channelType],
              ['Chatable 类型', activeChannel.chatable_type],
              ['Chatable ID', activeChannel.chatable_id || activeChannel.chatable?.id],
              ['Chatable URL', activeChannel.chatable_url],
              ['描述', activeChannel.description]
            ],
            'chat-channel-identity-title'
          )}
          {renderInfoGroup(
            '功能与状态',
            [
              ['状态', activeChannel.status || 'open'],
              ['启用消息串', activeChannel.threading_enabled],
              ['用户自动加入', activeChannel.auto_join_users],
              ['允许全频道提及', activeChannel.allow_channel_wide_mentions],
              ['成员数', activeChannel.memberships_count],
              ['置顶消息数', activeChannel.pinned_messages_count],
              ['最后消息 ID', activeChannel.last_message_id || activeChannel.last_message?.id],
              ['最后消息时间', activeChannel.last_message_sent_at]
            ],
            'chat-channel-capabilities-title'
          )}
          {renderInfoGroup(
            '历史与归档',
            [
              ['总消息数', activeChannel.total_messages],
              ['已归档消息', activeChannel.archived_messages],
              ['归档已完成', activeChannel.archive_completed],
              ['归档失败', activeChannel.archive_failed],
              ['归档主题 ID', activeChannel.archive_topic_id]
            ],
            'chat-channel-archive-title'
          )}
          {renderInfoGroup(
            '我的成员资料',
            [
              ['成员资料 ID', membership?.id],
              ['关注中', membership?.following],
              ['已收藏', membership?.starred],
              ['免打扰', membership?.muted],
              ['通知级别', membership?.notification_level],
              ['未读数', membership?.unread_count],
              ['最后已读消息 ID', membership?.last_read_message_id],
              ['最后查看时间', membership?.last_viewed_at],
              ['最后查看置顶时间', membership?.last_viewed_pins_at],
              ['有未读置顶', membership?.has_unseen_pins]
            ],
            'chat-channel-membership-title'
          )}
          {renderInfoGroup('当前权限', permissionRows, 'chat-channel-permissions-title')}
          <details class="chat-manage-modal__metadata-details">
            <summary>查看完整频道 JSON</summary>
            <pre>{JSON.stringify(activeChannel, null, 2)}</pre>
          </details>
        </div>
      )
    }

    const renderDangerZone = (activeChannel: ChatChannel) => (
      <section class="chat-settings-card chat-settings-danger" aria-labelledby="chat-danger-title">
        <div class="chat-settings-card__heading">
          <div>
            <h3 id="chat-danger-title">危险操作</h3>
            <p>退出或删除频道前请确认影响范围。</p>
          </div>
          <WarningOutlined />
        </div>
        {hasMembership.value && (
          <div class="chat-settings-danger__row">
            <div>
              <strong>退出频道</strong>
              <span>退出后将停止追踪频道；群组私信会移除你的成员资料。</span>
            </div>
            <button
              type="button"
              class="chat-settings-button is-danger"
              aria-label="退出频道"
              disabled={props.leavingChannel}
              onClick={() => emit('leaveChannel', activeChannel.id)}
            >
              <LogoutOutlined /> {props.leavingChannel ? '退出中…' : '退出频道'}
            </button>
          </div>
        )}
        {canModerate.value && !isDirect.value && (
          <div class="chat-settings-danger__row">
            <div>
              <strong>删除频道</strong>
              <span>永久删除频道及其聊天历史，此操作不可恢复。</span>
            </div>
            <button
              type="button"
              class="chat-settings-button is-danger"
              aria-label="删除频道"
              disabled={props.deletingChannel}
              onClick={() => emit('deleteChannel', activeChannel.id)}
            >
              <DeleteOutlined /> {props.deletingChannel ? '删除中…' : '删除频道'}
            </button>
          </div>
        )}
      </section>
    )

    return () => {
      const activeChannel = channel.value
      if (!props.open || !activeChannel) return null
      const title =
        activeChannel.title ||
        activeChannel.unicode_title ||
        activeChannel.chatable?.name ||
        `频道 ${activeChannel.id}`
      const rawChannelEmoji = activeChannel.emoji || activeChannel.chatable?.emoji || ''
      const channelIcon =
        rawChannelEmoji && /\p{Emoji_Presentation}/u.test(rawChannelEmoji)
          ? rawChannelEmoji
          : isDirect.value
            ? '💬'
            : '#'

      const tabs: Array<{ id: ManageTab; label: string; icon: any }> = [
        { id: 'settings', label: '设置', icon: <SettingOutlined /> },
        { id: 'members', label: `成员 ${memberCount.value}`, icon: <TeamOutlined /> },
        { id: 'info', label: '信息', icon: <InfoCircleOutlined /> }
      ]

      return (
        <div class="chat-manage-modal">
          <div class="chat-manage-modal__backdrop" onClick={() => emit('close')} />
          <div
            ref={panelRef}
            class="chat-manage-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-manage-modal-title"
            tabindex="-1"
          >
            <header class="chat-manage-modal__header">
              <div class="chat-manage-modal__title-wrap">
                <div class="chat-manage-modal__channel-icon" aria-hidden="true">
                  {channelIcon}
                </div>
                <div>
                  <div id="chat-manage-modal-title" class="chat-manage-modal__title">
                    {title}
                  </div>
                  <div class="chat-manage-modal__subtitle">
                    {isDirect.value ? '直接消息' : '聊天频道'} · #{activeChannel.id}
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="chat-manage-modal__close"
                aria-label="关闭聊天设置"
                onClick={() => emit('close')}
              >
                <CloseOutlined />
              </button>
            </header>

            <div class="chat-manage-modal__tabs" role="tablist" aria-label="聊天频道管理">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  id={`chat-manage-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab.value === tab.id}
                  aria-controls={`chat-manage-panel-${tab.id}`}
                  tabindex={activeTab.value === tab.id ? 0 : -1}
                  class={['chat-manage-modal__tab', activeTab.value === tab.id && 'is-active']}
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <main
              id={`chat-manage-panel-${activeTab.value}`}
              class="chat-manage-modal__body"
              role="tabpanel"
              aria-labelledby={`chat-manage-tab-${activeTab.value}`}
            >
              {activeTab.value === 'settings' && (
                <>
                  <ChatChannelSettingsPanel
                    channel={activeChannel}
                    savingChannel={props.savingChannel}
                    savingMembership={props.savingMembership}
                    savingStatus={props.savingStatus}
                    savingFollow={props.savingFollow}
                    onUpdateChannel={payload => emit('updateChannel', payload)}
                    onUpdateMembership={payload => emit('updateMembership', payload)}
                    onUpdateStatus={payload => emit('updateStatus', payload)}
                    onFollow={(channelId: number) => emit('follow', channelId)}
                    onUnfollow={(channelId: number) => emit('unfollow', channelId)}
                  />
                  {renderDangerZone(activeChannel)}
                </>
              )}
              {activeTab.value === 'members' && renderMembers()}
              {activeTab.value === 'info' && renderInfo(activeChannel)}
            </main>

            <footer class="chat-manage-modal__footer">
              <span>所有值均来自当前 Discourse 频道。</span>
              <button type="button" class="chat-manage-modal__done" onClick={() => emit('close')}>
                完成
              </button>
            </footer>
          </div>
        </div>
      )
    }
  }
})
