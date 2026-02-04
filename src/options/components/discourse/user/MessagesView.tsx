import { defineComponent } from 'vue'
import { Spin } from 'ant-design-vue'

import type { DiscourseUserProfile, MessagesState, MessagesTabType, DiscourseUser } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import UserTabs from './UserTabs'
import '../css/MessagesView.css'

export default defineComponent({
  name: 'MessagesView',
  props: {
    user: { type: Object as () => DiscourseUserProfile, required: true },
    messagesState: { type: Object as () => MessagesState, required: true },
    baseUrl: { type: String, required: true },
    isLoadingMore: { type: Boolean, required: true },
    users: { type: Object as () => Map<number, DiscourseUser>, required: true },
    showSettings: { type: Boolean, default: false },
    showGroups: { type: Boolean, default: true }
  },
  emits: ['switchTab', 'openTopic', 'openUser', 'goToProfile', 'switchMainTab'],
  setup(props, { emit }) {
    const tabs: { key: MessagesTabType; label: string }[] = [
      { key: 'all', label: '全部' },
      { key: 'sent', label: '已发送' },
      { key: 'new', label: '新消息' },
      { key: 'unread', label: '未读' },
      { key: 'archive', label: '归档' }
    ]

    return () => (
      <div class="messages-view space-y-4">
        {/* User header (compact) */}
        <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <img
            src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 64)}
            alt={props.user.username}
            class="w-16 h-16 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500"
            onClick={() => emit('goToProfile')}
          />
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h2
                class="text-xl font-bold dark:text-white cursor-pointer hover:text-blue-500"
                onClick={() => emit('goToProfile')}
              >
                {props.user.username}
              </h2>
              <span class="px-2 py-0.5 text-xs bg-purple-500 text-white rounded">私信</span>
            </div>
            {props.user.name && <div class="text-sm text-gray-500">{props.user.name}</div>}
          </div>
        </div>

        <UserTabs
          active="messages"
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={(
            tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
          ) => emit('switchMainTab', tab)}
        />

        {/* Tab navigation */}
        <div class="flex gap-1 overflow-x-auto border-b dark:border-gray-700 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              class={[
                'px-4 py-2 text-sm rounded-t whitespace-nowrap transition-colors',
                props.messagesState.activeTab === tab.key
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              ]}
              onClick={() => emit('switchTab', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Messages list */}
        <div class="messages-content space-y-2">
          {props.messagesState.topics.map(topic => (
            <div
              key={topic.id}
              class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer transition-colors"
              onClick={() => emit('openTopic', topic)}
            >
              <div class="flex items-start gap-3">
                {/* Participants avatars */}
                <div class="flex -space-x-2 flex-shrink-0">
                  {topic.participants && topic.participants.length > 0 ? (
                    topic.participants.slice(0, 3).map((participant, index) => (
                      <div key={participant.user_id} class="relative" style={{ zIndex: 3 - index }}>
                        {props.users.get(participant.user_id) ? (
                          <img
                            src={getAvatarUrl(
                              props.users.get(participant.user_id)!.avatar_template,
                              props.baseUrl,
                              40
                            )}
                            alt={props.users.get(participant.user_id)!.username}
                            class="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 object-cover"
                          />
                        ) : (
                          <div class="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300">
                            {index + 1}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <span class="text-purple-500 text-lg">@</span>
                    </div>
                  )}
                </div>

                <div class="flex-1 min-w-0">
                  {/* Title */}
                  <div
                    class="font-medium dark:text-white truncate"
                    innerHTML={topic.fancy_title || topic.title}
                  />

                  {/* Meta info */}
                  <div class="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span>{topic.posts_count} 条消息</span>
                    {topic.allowed_user_count && <span>{topic.allowed_user_count} 位参与者</span>}
                    <span>{topic.like_count} 赞</span>
                    <span>{formatTime(topic.last_posted_at || topic.created_at)}</span>
                  </div>

                  {/* Unread indicator */}
                  {((topic.unread || 0) > 0 || (topic.new_posts || 0) > 0) && (
                    <div class="mt-2">
                      {(topic.unread || 0) > 0 && (
                        <span class="inline-block px-2 py-0.5 text-xs bg-red-500 text-white rounded mr-2">
                          {topic.unread} 未读
                        </span>
                      )}
                      {(topic.new_posts || 0) > 0 && (
                        <span class="inline-block px-2 py-0.5 text-xs bg-blue-500 text-white rounded">
                          {topic.new_posts} 新消息
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {props.messagesState.topics.length === 0 && !props.isLoadingMore && (
            <div class="text-center text-gray-400 py-8">
              {props.messagesState.activeTab === 'all'
                ? '暂无私信'
                : props.messagesState.activeTab === 'sent'
                  ? '暂无已发送私信'
                  : props.messagesState.activeTab === 'new'
                    ? '暂无新消息'
                    : props.messagesState.activeTab === 'unread'
                      ? '暂无未读消息'
                      : '暂无归档消息'}
            </div>
          )}

          {/* Loading more indicator */}
          {props.isLoadingMore && (
            <div class="flex items-center justify-center py-4">
              <Spin />
              <span class="ml-2 text-gray-500">加载更多...</span>
            </div>
          )}

          {/* End indicator */}
          {!props.messagesState.hasMore &&
            !props.isLoadingMore &&
            props.messagesState.topics.length > 0 && (
              <div class="text-center text-gray-400 py-4 text-sm">已加载全部</div>
            )}
        </div>
      </div>
    )
  }
})
