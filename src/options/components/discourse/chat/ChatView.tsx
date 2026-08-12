import { computed, defineComponent, ref, watch } from 'vue'
import {
  CommentOutlined,
  CompassOutlined,
  PlusOutlined,
  PushpinOutlined,
  SearchOutlined,
  SettingOutlined,
  UserAddOutlined
} from '@ant-design/icons-vue'

import type {
  ChatChannel,
  ChatChannelEditableStatus,
  ChatChannelUpdatePayload,
  ChatCreateChannelPayload,
  ChatMembershipUpdatePayload,
  ChatMessage,
  ChatState,
  ChatThread,
  DiscourseCategory,
  DiscourseUser
} from '../types'
import EmojiTitle from '../layout/EmojiTitle'

import ChatChannelList, { type ChatChannelListFilter } from './ChatChannelList'
import ChatSubTabs, { type ChatSidebarTab } from './ChatSubTabs'
import ChatDiscoverPanel from './ChatDiscoverPanel'
import ChatThreadList from './ChatThreadList'
import ChatMessageList from './ChatMessageList'
import ChatComposer from './ChatComposer'
import ChatCreateGroupModal from './ChatCreateGroupModal'
import ChatCreateChannelModal from './ChatCreateChannelModal'
import ChatChannelManageModal from './ChatChannelManageModal'
import ChatThreadPanel from './ChatThreadPanel'
import ChatChannelThreadsPanel from './ChatChannelThreadsPanel'
import ChatPinnedMessagesPanel from './ChatPinnedMessagesPanel'
import ChatSearchPanel from './ChatSearchPanel'
import '../css/chat/ChatView.css'

export default defineComponent({
  name: 'ChatView',
  props: {
    chatState: { type: Object as () => ChatState, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    currentUserStaff: { type: Boolean, default: false },
    users: { type: Object as () => Map<number, DiscourseUser>, required: true },
    categories: { type: Array as () => DiscourseCategory[], default: () => [] },
    createGroupSearching: { type: Boolean, default: false },
    createGroupResults: { type: Array as () => DiscourseUser[], default: () => [] },
    creatingGroup: { type: Boolean, default: false },
    creatingChannel: { type: Boolean, default: false },
    manageSearching: { type: Boolean, default: false },
    manageSearchResults: { type: Array as () => DiscourseUser[], default: () => [] },
    savingChannel: { type: Boolean, default: false },
    savingMembership: { type: Boolean, default: false },
    savingStatus: { type: Boolean, default: false },
    savingFollow: { type: Boolean, default: false },
    leavingChannel: { type: Boolean, default: false },
    deletingChannel: { type: Boolean, default: false },
    discoverChannels: { type: Array as () => ChatChannel[], default: () => [] },
    discoverLoading: { type: Boolean, default: false },
    discoverErrorMessage: { type: String, default: '' },
    joiningChannelIds: { type: Object as () => Record<number, boolean>, default: () => ({}) },
    /** 初始子 tab（用于 /chat/threads 等 URL 恢复） */
    initialSidebarTab: { type: String as () => ChatSidebarTab, default: 'public' }
  },
  emits: [
    'selectChannel',
    'loadMore',
    'openThread',
    'selectThread',
    'closeThread',
    'loadMoreThread',
    'loadMyThreads',
    'loadMoreMyThreads',
    'loadChannelThreads',
    'loadMoreChannelThreads',
    'loadPins',
    'pinMessage',
    'openPinnedMessage',
    'searchMessages',
    'loadMoreSearch',
    'updateThreadNotification',
    'updateThreadTitle',
    'sendMessage',
    'sendThreadMessage',
    'navigate',
    'react',
    'editChannel',
    'interact',
    'replyToMessage',
    'replyToThreadMessage',
    'cancelReply',
    'cancelThreadReply',
    'editMessage',
    'editThreadMessage',
    'cancelEdit',
    'cancelThreadEdit',
    'deleteMessage',
    'flagMessage',
    'uploadStart',
    'uploadEnd',
    'createGroup',
    'createChannel',
    'createGroupSearch',
    'loadMembers',
    'loadMoreMembers',
    'addMembers',
    'removeMember',
    'followChannel',
    'unfollowChannel',
    'updateMembership',
    'updateStatus',
    'leaveChannel',
    'deleteChannel',
    'manageSearch',
    'discoverChannels',
    'joinChannel',
    'addDirectUsers',
    'sidebarTab'
  ],
  setup(props, { emit }) {
    const showCreateGroup = ref(false)
    const showCreateChannel = ref(false)
    const showManage = ref(false)
    const showChannelThreads = ref(false)
    const showPins = ref(false)
    const showSearch = ref(false)
    const showDiscover = ref(false)
    const sidebarTab = ref<ChatSidebarTab>(props.initialSidebarTab)
    const searchInitialChannelId = ref<number | null>(null)

    const channelListFilter = computed<ChatChannelListFilter>(() => {
      if (sidebarTab.value === 'public') return 'public'
      if (sidebarTab.value === 'direct') return 'direct'
      if (sidebarTab.value === 'starred') return 'starred'
      return 'all'
    })

    const isDirectChannel = (channel: ChatChannel) =>
      channel.channelType === 'direct' ||
      channel.chatable_type === 'DirectMessage' ||
      !!channel.chatable?.users?.length

    const getChannelUnread = (channel: ChatChannel) => {
      const count = Number(channel.current_user_membership?.unread_count || 0)
      const mention = Number(channel.current_user_membership?.mention_count || 0)
      return Math.max(count, mention)
    }

    const sidebarUnreadPublic = computed(() =>
      props.chatState.channels.reduce(
        (total, channel) => (isDirectChannel(channel) ? total : total + getChannelUnread(channel)),
        0
      )
    )

    const sidebarUnreadDirect = computed(() =>
      props.chatState.channels.reduce(
        (total, channel) => (isDirectChannel(channel) ? total + getChannelUnread(channel) : total),
        0
      )
    )

    const sidebarUnreadStarred = computed(() =>
      props.chatState.channels.reduce(
        (total, channel) =>
          channel.current_user_membership?.starred ? total + getChannelUnread(channel) : total,
        0
      )
    )

    const sidebarUnreadThreads = computed(() =>
      props.chatState.myThreads.reduce(
        (total, thread) =>
          total +
          Math.max(
            Number(thread.tracking?.unread_count || 0),
            Number(thread.tracking?.watched_threads_unread_count || 0)
          ),
        0
      )
    )

    const activeChannel = computed(
      () =>
        props.chatState.channels.find(channel => channel.id === props.chatState.activeChannelId) ||
        null
    )

    watch(
      () => props.chatState.activeChannelId,
      (channelId, previousChannelId) => {
        if (showManage.value && previousChannelId && channelId !== previousChannelId) {
          showManage.value = false
        }
        if (previousChannelId && channelId !== previousChannelId) {
          showChannelThreads.value = false
          showPins.value = false
          showSearch.value = false
          showDiscover.value = false
        }
        if (channelId && channelId !== previousChannelId) {
          showCreateGroup.value = false
          showCreateChannel.value = false
        }
      }
    )

    watch(
      () => props.chatState.activeThread?.id,
      threadId => {
        if (threadId) {
          showChannelThreads.value = false
          showPins.value = false
          showSearch.value = false
          showDiscover.value = false
        }
      }
    )

    watch(
      () => props.creatingGroup,
      (creating, wasCreating) => {
        if (wasCreating && !creating && !props.chatState.errorMessage) {
          showCreateGroup.value = false
        }
      }
    )

    watch(
      () => props.creatingChannel,
      (creating, wasCreating) => {
        if (wasCreating && !creating && !props.chatState.errorMessage) {
          showCreateChannel.value = false
        }
      }
    )

    const activeChannelTitle = computed(() => {
      const channel = activeChannel.value
      if (!channel) return '聊天'
      if (channel.title) return channel.title
      if (channel.channelType === 'direct' && channel.direct_message_users) {
        return channel.direct_message_users
          .map(u => u.name || u.username)
          .filter(Boolean)
          .join(', ')
      }
      return channel.chatable?.name || `频道 ${channel.id}`
    })

    const activeMessages = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return []
      return props.chatState.messagesByChannel[channelId] || []
    })

    const hasMore = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return false
      return props.chatState.hasMoreByChannel[channelId] !== false
    })

    const activeThreadMessages = computed(() => {
      const threadId = props.chatState.activeThread?.id
      if (!threadId) return []
      return props.chatState.threadMessagesById[threadId] || []
    })

    const activeThreadHasMore = computed(() => {
      const threadId = props.chatState.activeThread?.id
      if (!threadId) return false
      return props.chatState.threadHasMoreById[threadId] !== false
    })

    const activeChannelThreads = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return []
      return props.chatState.channelThreadsByChannel[channelId] || []
    })

    const activeChannelThreadUnreadCount = computed(() => {
      const channel = activeChannel.value
      if (!channel) return 0
      const membershipCount = Number(
        channel.current_user_membership?.watched_threads_unread_count || 0
      )
      if (membershipCount > 0) return membershipCount
      return activeChannelThreads.value.reduce(
        (total, thread) =>
          total +
          Math.max(
            Number(thread.tracking?.unread_count || 0),
            Number(thread.tracking?.watched_threads_unread_count || 0)
          ),
        0
      )
    })

    const activePinnedMessages = computed(() => {
      const channelId = props.chatState.activeChannelId
      return channelId ? props.chatState.pinnedMessagesByChannel?.[channelId] || [] : []
    })

    const activePinnedMessageIds = computed(() =>
      activePinnedMessages.value.map(pin => pin.chat_message_id)
    )

    const activePinSavingByMessageId = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return {}
      const prefix = `${channelId}:`
      return Object.entries(props.chatState.pinSavingByMessageId || {}).reduce<
        Record<number, boolean>
      >((result, [key, saving]) => {
        if (!key.startsWith(prefix) || !saving) return result
        const messageId = Number(key.slice(prefix.length))
        if (Number.isFinite(messageId) && messageId > 0) result[messageId] = true
        return result
      }, {})
    })

    const canManageActivePins = computed(() =>
      Boolean(activeChannel.value?.meta?.can_manage_pins || activeChannel.value?.meta?.can_moderate)
    )

    const activePinsLoading = computed(() => {
      const channelId = props.chatState.activeChannelId
      return channelId ? Boolean(props.chatState.pinsLoadingByChannel?.[channelId]) : false
    })

    const activePinsError = computed(() => {
      const channelId = props.chatState.activeChannelId
      return channelId ? props.chatState.pinsErrorByChannel?.[channelId] || '' : ''
    })

    const activeTypingUsers = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return []
      const typing = props.chatState.typingUsers[channelId]
      if (!typing || typing.length === 0) return []
      return typing.filter(u => u.username !== props.currentUsername)
    })

    const typingText = computed(() => {
      const users = activeTypingUsers.value
      if (users.length === 0) return ''
      const names = users.map(u => u.name || u.username)
      if (names.length === 1) return `${names[0]} 正在输入...`
      if (names.length === 2) return `${names[0]} 和 ${names[1]} 正在输入...`
      return `${names[0]} 和其他人正在输入...`
    })

    const activeMembers = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return []
      return props.chatState.membersByChannel[channelId] || []
    })

    const activeMembersTotal = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return 0
      return props.chatState.membersTotalByChannel[channelId] || 0
    })

    const activeMembersLoading = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return false
      return !!props.chatState.membersLoadingByChannel[channelId]
    })

    const activeMembersHasMore = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return false
      return props.chatState.membersHasMoreByChannel[channelId] === true
    })

    const handleSelectChannel = (channel: ChatChannel) => {
      emit('selectChannel', channel)
    }

    const handleLoadMore = () => {
      if (!props.chatState.activeChannelId) return
      emit('loadMore', props.chatState.activeChannelId)
    }

    const handleSend = (message: string) => {
      if (!props.chatState.activeChannelId) return
      emit('sendMessage', { channelId: props.chatState.activeChannelId, message })
    }

    const handleNavigate = (url: string) => {
      emit('navigate', url)
    }

    const handleReact = (payload: { messageId: number; emoji: string; reacted?: boolean }) => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return
      emit('react', { channelId, ...payload })
    }

    const handleInteract = (payload: { messageId: number; actionId: string }) => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return
      emit('interact', { channelId, ...payload })
    }

    const handleReplyToMessage = (message: ChatMessage) => {
      emit('replyToMessage', message)
    }

    const handleOpenThread = (message: ChatMessage) => {
      showChannelThreads.value = false
      emit('openThread', message)
    }

    const handleOpenPins = () => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return
      showChannelThreads.value = false
      showSearch.value = false
      showDiscover.value = false
      emit('closeThread')
      showPins.value = true
      emit('loadPins', channelId)
    }

    const handlePinMessage = (payload: { messageId: number; pinned: boolean }) => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return
      emit('pinMessage', { channelId, ...payload })
    }

    const handleSelectChannelThread = (thread: ChatThread) => {
      showChannelThreads.value = false
      emit('selectThread', thread)
    }

    const handleCancelReply = () => {
      emit('cancelReply')
    }

    const handleEditMessage = (message: ChatMessage) => {
      emit('editMessage', message)
    }

    const handleCancelEdit = () => {
      emit('cancelEdit')
    }

    const handleDeleteMessage = (message: ChatMessage) => {
      emit('deleteMessage', { channelId: props.chatState.activeChannelId, messageId: message.id })
    }

    const handleFlagMessage = (message: ChatMessage) => {
      emit('flagMessage', {
        channelId: props.chatState.activeChannelId || message.chat_channel_id,
        message
      })
    }

    const handleCreateGroup = (payload: { targetUsernames: string[]; name?: string }) => {
      emit('createGroup', payload)
    }

    const handleCreateChannel = (payload: ChatCreateChannelPayload) => {
      emit('createChannel', payload)
    }

    const handleSelectSidebarTab = (tab: ChatSidebarTab) => {
      sidebarTab.value = tab
      emit('sidebarTab', tab)
      if (tab === 'threads') {
        showDiscover.value = false
      }
    }

    const handleOpenDiscover = () => {
      showDiscover.value = true
      showSearch.value = false
      showChannelThreads.value = false
      emit('discoverChannels')
    }

    const handleJoinChannel = (channelId: number) => {
      emit('joinChannel', channelId)
    }

    const handleAddDirectUsers = (payload: { channelId: number; usernames: string[] }) => {
      emit('addDirectUsers', payload)
    }

    const openSearch = (initialChannelId: number | null) => {
      searchInitialChannelId.value = initialChannelId
      showChannelThreads.value = false
      showSearch.value = true
    }

    return () => (
      <div class={['chat-view', props.chatState.activeThread ? 'has-thread-panel' : '']}>
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <span class="chat-sidebar-header__title">聊天</span>
            <div class="chat-sidebar-header__actions">
              {props.chatState.capabilities.chatEnabled && (
                <button
                  type="button"
                  class="chat-sidebar-header__create"
                  aria-label="搜索聊天消息"
                  title="搜索聊天消息"
                  onClick={() => openSearch(null)}
                >
                  <SearchOutlined />
                </button>
              )}
              {props.chatState.capabilities.chatEnabled && (
                <button
                  type="button"
                  class="chat-sidebar-header__create"
                  aria-label="发现频道"
                  title="发现频道"
                  onClick={handleOpenDiscover}
                >
                  <CompassOutlined />
                </button>
              )}
              {props.chatState.capabilities.canDirectMessage && (
                <button
                  type="button"
                  class="chat-sidebar-header__create"
                  aria-label="发起聊天"
                  title="发起聊天"
                  onClick={() => (showCreateGroup.value = true)}
                >
                  <UserAddOutlined />
                </button>
              )}
              {props.chatState.capabilities.canCreatePublicChannel && (
                <button
                  type="button"
                  class="chat-sidebar-header__create"
                  aria-label="创建公开频道"
                  title="创建公开频道"
                  onClick={() => (showCreateChannel.value = true)}
                >
                  <PlusOutlined />
                </button>
              )}
            </div>
          </div>
          {props.chatState.errorMessage && (
            <div class="chat-error">{props.chatState.errorMessage}</div>
          )}
          <div class="chat-sidebar__scroll">
            <ChatSubTabs
              active={sidebarTab.value}
              unreadPublic={sidebarUnreadPublic.value}
              unreadDirect={sidebarUnreadDirect.value}
              unreadStarred={sidebarUnreadStarred.value}
              unreadThreads={sidebarUnreadThreads.value}
              onSelect={handleSelectSidebarTab}
            />
            {sidebarTab.value !== 'threads' && (
              <ChatChannelList
                channels={props.chatState.channels}
                activeChannelId={props.chatState.activeChannelId}
                baseUrl={props.baseUrl}
                currentUsername={props.currentUsername}
                loading={props.chatState.loadingChannels}
                filter={channelListFilter.value}
                onSelect={handleSelectChannel}
              />
            )}
            {sidebarTab.value === 'threads' && (
              <ChatThreadList
                threads={props.chatState.myThreads}
                activeThreadId={props.chatState.activeThread?.id || null}
                baseUrl={props.baseUrl}
                loaded={props.chatState.myThreadsLoaded}
                loading={props.chatState.loadingMyThreads}
                loadingMore={props.chatState.loadingMoreMyThreads}
                loadMoreUrl={props.chatState.myThreadsLoadMoreUrl}
                errorMessage={props.chatState.myThreadsErrorMessage}
                onLoad={() => emit('loadMyThreads')}
                onLoadMore={() => emit('loadMoreMyThreads')}
                onSelect={(thread: ChatThread) => emit('selectThread', thread)}
              />
            )}
          </div>
        </div>

        <div class="chat-main">
          <div class="chat-main-header">
            <div class="chat-main-title">
              <EmojiTitle
                className="chat-main-title__text"
                text={activeChannelTitle.value}
                baseUrl={props.baseUrl}
              />
            </div>
            <div class="chat-main-actions">
              {activeChannel.value && (
                <button
                  type="button"
                  class="chat-main-action-btn"
                  aria-label={`在${activeChannelTitle.value}中搜索`}
                  title="在当前频道搜索"
                  onClick={() => openSearch(activeChannel.value?.id || null)}
                >
                  <SearchOutlined />
                  <span>搜索</span>
                </button>
              )}
              {activeChannel.value?.threading_enabled && (
                <button
                  type="button"
                  class={[
                    'chat-main-action-btn',
                    activeChannelThreadUnreadCount.value > 0 ? 'has-unread' : ''
                  ]}
                  aria-label={
                    activeChannelThreadUnreadCount.value > 0
                      ? `查看频道消息串，${activeChannelThreadUnreadCount.value} 条未读`
                      : '查看频道消息串'
                  }
                  title="查看频道消息串"
                  onClick={() => (showChannelThreads.value = true)}
                >
                  <CommentOutlined />
                  <span>消息串</span>
                  {activeChannelThreadUnreadCount.value > 0 && (
                    <span class="chat-main-action-btn__badge">
                      {activeChannelThreadUnreadCount.value}
                    </span>
                  )}
                </button>
              )}
              {activeChannel.value && (
                <button
                  type="button"
                  class={[
                    'chat-main-action-btn',
                    activeChannel.value.current_user_membership?.has_unseen_pins ? 'has-unread' : ''
                  ]}
                  aria-label={
                    activeChannel.value.current_user_membership?.has_unseen_pins
                      ? `查看置顶消息，有未读置顶`
                      : '查看置顶消息'
                  }
                  title="查看置顶消息"
                  onClick={handleOpenPins}
                >
                  <PushpinOutlined />
                  <span>置顶</span>
                  {Number(activeChannel.value.pinned_messages_count || 0) > 0 && (
                    <span class="chat-main-action-btn__badge">
                      {activeChannel.value.pinned_messages_count}
                    </span>
                  )}
                </button>
              )}
              {activeChannel.value && (
                <button
                  type="button"
                  class="chat-main-action-btn"
                  onClick={() => (showManage.value = true)}
                  title="管理频道"
                >
                  <SettingOutlined /> 管理
                </button>
              )}
            </div>
          </div>

          {showDiscover.value && (
            <ChatDiscoverPanel
              channels={props.discoverChannels}
              loading={props.discoverLoading}
              errorMessage={props.discoverErrorMessage}
              joiningChannelIds={props.joiningChannelIds}
              baseUrl={props.baseUrl}
              onClose={() => (showDiscover.value = false)}
              onLoad={() => emit('discoverChannels')}
              onJoin={handleJoinChannel}
            />
          )}

          {showSearch.value && (
            <ChatSearchPanel
              searchState={props.chatState.searchState}
              channels={props.chatState.channels}
              baseUrl={props.baseUrl}
              initialChannelId={searchInitialChannelId.value ?? undefined}
              onClose={() => (showSearch.value = false)}
              onSearch={(payload: {
                query: string
                channelId: number | null
                sort: 'relevance' | 'latest'
              }) => emit('searchMessages', payload)}
              onLoadMore={() => emit('loadMoreSearch')}
              onNavigate={handleNavigate}
            />
          )}

          {activeChannel.value ? (
            <ChatMessageList
              messages={activeMessages.value}
              channel={activeChannel.value}
              channelId={props.chatState.activeChannelId ?? undefined}
              baseUrl={props.baseUrl}
              currentUsername={props.currentUsername}
              loading={props.chatState.loadingMessages}
              hasMore={hasMore.value}
              targetMessageId={props.chatState.activeTargetMessageId ?? undefined}
              threadingEnabled={Boolean(activeChannel.value?.threading_enabled)}
              canManagePins={canManageActivePins.value}
              pinnedMessageIds={activePinnedMessageIds.value}
              pinSavingByMessageId={activePinSavingByMessageId.value}
              onLoadMore={handleLoadMore}
              onNavigate={handleNavigate}
              onReact={handleReact}
              onInteract={handleInteract}
              onReply={handleReplyToMessage}
              onOpenThread={handleOpenThread}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onFlag={handleFlagMessage}
              onPin={handlePinMessage}
            />
          ) : (
            <div class="chat-empty">请选择一个频道开始聊天</div>
          )}

          {typingText.value && <div class="chat-typing-indicator">{typingText.value}</div>}

          <ChatComposer
            disabled={!activeChannel.value || props.chatState.sendingMessage}
            replyTo={props.chatState.replyToMessage}
            editingMessage={props.chatState.editingMessage}
            baseUrl={props.baseUrl}
            channelId={props.chatState.activeChannelId || 0}
            onSend={handleSend}
            onCancelReply={handleCancelReply}
            onCancelEdit={handleCancelEdit}
            onUploadStart={() => emit('uploadStart')}
            onUploadEnd={() => emit('uploadEnd')}
          />

          {props.chatState.loadingThread && !props.chatState.activeThread && (
            <div class="chat-thread-opening" role="status" aria-live="polite">
              正在打开消息串…
            </div>
          )}
          {!props.chatState.activeThread && props.chatState.threadErrorMessage && (
            <div class="chat-thread-opening is-error" role="alert">
              {props.chatState.threadErrorMessage}
            </div>
          )}
          {showChannelThreads.value && activeChannel.value && (
            <ChatChannelThreadsPanel
              channel={activeChannel.value}
              threads={activeChannelThreads.value}
              activeThreadId={props.chatState.activeThread?.id || null}
              baseUrl={props.baseUrl}
              loaded={Boolean(
                props.chatState.channelThreadsLoadedByChannel[activeChannel.value.id]
              )}
              loading={Boolean(
                props.chatState.channelThreadsLoadingByChannel[activeChannel.value.id]
              )}
              loadingMore={Boolean(
                props.chatState.channelThreadsLoadingMoreByChannel[activeChannel.value.id]
              )}
              loadMoreUrl={
                props.chatState.channelThreadsLoadMoreUrlByChannel[activeChannel.value.id] || null
              }
              errorMessage={
                props.chatState.channelThreadsErrorByChannel[activeChannel.value.id] || ''
              }
              onClose={() => (showChannelThreads.value = false)}
              onLoad={(channelId: number) => emit('loadChannelThreads', channelId)}
              onLoadMore={(channelId: number) => emit('loadMoreChannelThreads', channelId)}
              onSelect={handleSelectChannelThread}
            />
          )}
          {showPins.value && activeChannel.value && (
            <ChatPinnedMessagesPanel
              channel={activeChannel.value}
              pins={activePinnedMessages.value}
              loading={activePinsLoading.value}
              errorMessage={activePinsError.value}
              baseUrl={props.baseUrl}
              onClose={() => (showPins.value = false)}
              onLoad={(channelId: number) => emit('loadPins', channelId)}
              onOpen={(messageId: number) => {
                showPins.value = false
                emit('openPinnedMessage', {
                  channelId: activeChannel.value?.id,
                  messageId
                })
              }}
            />
          )}
          {props.chatState.activeThread && activeChannel.value && (
            <ChatThreadPanel
              thread={props.chatState.activeThread}
              messages={activeThreadMessages.value}
              channelId={activeChannel.value.id}
              baseUrl={props.baseUrl}
              currentUsername={props.currentUsername}
              currentUserStaff={props.currentUserStaff}
              loading={props.chatState.loadingThread}
              sending={props.chatState.sendingThreadMessage}
              hasMore={activeThreadHasMore.value}
              targetMessageId={props.chatState.activeTargetMessageId ?? undefined}
              errorMessage={props.chatState.threadErrorMessage}
              replyTo={props.chatState.threadReplyToMessage}
              editingMessage={props.chatState.threadEditingMessage}
              notificationSaving={Boolean(
                props.chatState.threadNotificationSavingById[props.chatState.activeThread.id]
              )}
              titleSaving={Boolean(
                props.chatState.threadTitleSavingById[props.chatState.activeThread.id]
              )}
              canManagePins={canManageActivePins.value}
              pinnedMessageIds={activePinnedMessageIds.value}
              pinSavingByMessageId={activePinSavingByMessageId.value}
              onClose={() => emit('closeThread')}
              onLoadMore={(threadId: number) => emit('loadMoreThread', threadId)}
              onSend={(message: string) =>
                emit('sendThreadMessage', {
                  channelId: activeChannel.value?.id,
                  threadId: props.chatState.activeThread?.id,
                  message
                })
              }
              onNavigate={handleNavigate}
              onReact={handleReact}
              onInteract={handleInteract}
              onReply={(message: ChatMessage) => emit('replyToThreadMessage', message)}
              onCancelReply={() => emit('cancelThreadReply')}
              onEdit={(message: ChatMessage) => emit('editThreadMessage', message)}
              onCancelEdit={() => emit('cancelThreadEdit')}
              onUpdateNotificationLevel={(level: number) =>
                emit('updateThreadNotification', {
                  threadId: props.chatState.activeThread?.id,
                  level
                })
              }
              onUpdateTitle={(title: string) =>
                emit('updateThreadTitle', {
                  threadId: props.chatState.activeThread?.id,
                  title
                })
              }
              onDelete={handleDeleteMessage}
              onFlag={handleFlagMessage}
              onPin={handlePinMessage}
              onUploadStart={() => emit('uploadStart')}
              onUploadEnd={() => emit('uploadEnd')}
            />
          )}
        </div>

        <ChatCreateGroupModal
          open={showCreateGroup.value}
          baseUrl={props.baseUrl}
          currentUsername={props.currentUsername}
          searching={props.createGroupSearching}
          creating={props.creatingGroup}
          searchResults={props.createGroupResults}
          onClose={() => (showCreateGroup.value = false)}
          onCreate={handleCreateGroup}
          onSearch={(query: string) => emit('createGroupSearch', query)}
        />

        <ChatCreateChannelModal
          open={showCreateChannel.value}
          baseUrl={props.baseUrl}
          categories={props.categories}
          creating={props.creatingChannel}
          maxAutoJoinedUsers={props.chatState.capabilities.maxAutoJoinedUsers}
          onClose={() => (showCreateChannel.value = false)}
          onCreate={handleCreateChannel}
        />

        <ChatChannelManageModal
          open={showManage.value}
          channel={activeChannel.value}
          members={activeMembers.value}
          membersTotal={activeMembersTotal.value}
          membersLoading={activeMembersLoading.value}
          membersHasMore={activeMembersHasMore.value}
          baseUrl={props.baseUrl}
          currentUsername={props.currentUsername}
          searching={props.manageSearching}
          searchResults={props.manageSearchResults}
          savingChannel={props.savingChannel}
          savingMembership={props.savingMembership}
          savingStatus={props.savingStatus}
          savingFollow={props.savingFollow}
          leavingChannel={props.leavingChannel}
          deletingChannel={props.deletingChannel}
          onClose={() => (showManage.value = false)}
          onLoadMembers={(channelId: number) => emit('loadMembers', channelId)}
          onLoadMoreMembers={(channelId: number) => emit('loadMoreMembers', channelId)}
          onAddMembers={(payload: { channelId: number; usernames: string[] }) =>
            emit('addMembers', payload)
          }
          onRemoveMember={(payload: { channelId: number; userId: number }) =>
            emit('removeMember', payload)
          }
          onFollow={(channelId: number) => emit('followChannel', channelId)}
          onUnfollow={(channelId: number) => emit('unfollowChannel', channelId)}
          onUpdateChannel={(payload: { channelId: number; updates: ChatChannelUpdatePayload }) =>
            emit('editChannel', payload)
          }
          onUpdateMembership={(payload: {
            channelId: number
            updates: ChatMembershipUpdatePayload
          }) => emit('updateMembership', payload)}
          onUpdateStatus={(payload: { channelId: number; status: ChatChannelEditableStatus }) =>
            emit('updateStatus', payload)
          }
          onLeaveChannel={(channelId: number) => emit('leaveChannel', channelId)}
          onDeleteChannel={(channelId: number) => emit('deleteChannel', channelId)}
          onSearch={(query: string) => emit('manageSearch', query)}
          onAddDirectUsers={handleAddDirectUsers}
        />
      </div>
    )
  }
})
