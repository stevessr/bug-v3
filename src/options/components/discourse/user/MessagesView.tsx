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
      <div class="messages-view">
        <div class="messages-view-header-card">
          <img
            src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 64)}
            alt={props.user.username}
            class="messages-view-header-card__avatar"
            onClick={() => emit('goToProfile')}
          />
          <div class="messages-view-header-card__info">
            <div class="messages-view-header-card__title-row">
              <h2 class="messages-view-header-card__title" onClick={() => emit('goToProfile')}>
                {props.user.username}
              </h2>
              <span class="messages-view-header-card__badge">私信</span>
            </div>
            {props.user.name && (
              <div class="messages-view-header-card__subtitle">{props.user.name}</div>
            )}
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

        <div class="messages-subtabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              class={[
                'messages-subtabs__item',
                props.messagesState.activeTab === tab.key ? 'is-active' : ''
              ]}
              onClick={() => emit('switchTab', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div class="messages-content">
          {props.messagesState.topics.map(topic => (
            <div
              key={topic.id}
              class="messages-topic-item"
              onClick={() => emit('openTopic', topic)}
            >
              <div class="messages-topic-item__main">
                <div class="messages-topic-item__avatars">
                  {topic.participants && topic.participants.length > 0 ? (
                    topic.participants.slice(0, 3).map((participant, index) => {
                      const participantUser = props.users.get(participant.user_id)
                      return (
                        <div
                          key={participant.user_id}
                          class="messages-topic-item__avatar-wrap"
                          style={{ zIndex: 3 - index }}
                        >
                          {participantUser ? (
                            <img
                              src={getAvatarUrl(participantUser.avatar_template, props.baseUrl, 40)}
                              alt={participantUser.username}
                              class="messages-topic-item__avatar"
                            />
                          ) : (
                            <div class="messages-topic-item__avatar-fallback">{index + 1}</div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div class="messages-topic-item__avatar-empty">@</div>
                  )}
                </div>

                <div class="messages-topic-item__body">
                  <div
                    class="messages-topic-item__title"
                    innerHTML={topic.fancy_title || topic.title}
                  />

                  <div class="messages-topic-item__meta">
                    <span>{topic.posts_count} 条消息</span>
                    {topic.allowed_user_count && <span>{topic.allowed_user_count} 位参与者</span>}
                    <span>{topic.like_count} 赞</span>
                    <span>{formatTime(topic.last_posted_at || topic.created_at)}</span>
                  </div>

                  {((topic.unread || 0) > 0 || (topic.new_posts || 0) > 0) && (
                    <div class="messages-topic-item__badges">
                      {(topic.unread || 0) > 0 && (
                        <span class="messages-topic-item__badge is-unread">
                          {topic.unread} 未读
                        </span>
                      )}
                      {(topic.new_posts || 0) > 0 && (
                        <span class="messages-topic-item__badge is-new">
                          {topic.new_posts} 新消息
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {props.messagesState.topics.length === 0 && !props.isLoadingMore && (
            <div class="messages-state-empty">
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

          {props.isLoadingMore && (
            <div class="messages-state-loading">
              <Spin />
              <span>加载更多...</span>
            </div>
          )}

          {!props.messagesState.hasMore &&
            !props.isLoadingMore &&
            props.messagesState.topics.length > 0 && (
              <div class="messages-state-end">已加载全部</div>
            )}
        </div>
      </div>
    )
  }
})
