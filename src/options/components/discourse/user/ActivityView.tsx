import { defineComponent, computed } from 'vue'
import { Spin } from 'ant-design-vue'

import type { DiscourseUserProfile, UserActivityState, ActivityTabType } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import UserTabs from './UserTabs'
import '../css/ActivityView.css'

export default defineComponent({
  name: 'ActivityView',
  props: {
    user: { type: Object as () => DiscourseUserProfile, required: true },
    activityState: { type: Object as () => UserActivityState, required: true },
    baseUrl: { type: String, required: true },
    isLoadingMore: { type: Boolean, required: true },
    showReadTab: { type: Boolean, default: false },
    showSettings: { type: Boolean, default: false },
    showGroups: { type: Boolean, default: true }
  },
  emits: ['switchTab', 'openTopic', 'openUser', 'goToProfile', 'switchMainTab'],
  setup(props, { emit }) {
    const tabs: { key: ActivityTabType; label: string }[] = [
      { key: 'all', label: '所有' },
      { key: 'topics', label: '话题' },
      { key: 'replies', label: '回复' },
      { key: 'likes', label: '赞' },
      { key: 'reactions', label: '反应' },
      { key: 'solved', label: '已解决' },
      { key: 'assigned', label: '已指定' },
      { key: 'votes', label: '投票' },
      { key: 'portfolio', label: '作品集' },
      { key: 'read', label: '已读' }
    ]

    const visibleTabs = computed(() =>
      props.showReadTab ? tabs : tabs.filter(tab => tab.key !== 'read')
    )

    const emptyTopicsText = computed(() => {
      switch (props.activityState.activeTab) {
        case 'topics':
          return '暂无话题'
        case 'assigned':
          return '暂无已指定'
        case 'votes':
          return '暂无投票'
        case 'portfolio':
          return '暂无作品集'
        case 'read':
          return '暂无已读'
        default:
          return '暂无数据'
      }
    })

    const getActionTypeLabel = (actionType: number): string => {
      const types: Record<number, string> = {
        1: '赞了',
        2: '收藏了',
        3: '回复了',
        4: '创建了话题',
        5: '回复了',
        6: '被提及',
        7: '引用了',
        9: '收到回复',
        11: '编辑了',
        12: '发送了消息',
        13: '收到消息'
      }
      return types[actionType] || '活动'
    }

    return () => (
      <div class="activity-view">
        <div class="activity-view-header-card">
          <img
            src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 64)}
            alt={props.user.username}
            class="activity-view-header-card__avatar"
            onClick={() => emit('goToProfile')}
          />
          <div class="activity-view-header-card__info">
            <div class="activity-view-header-card__title-row">
              <h2 class="activity-view-header-card__title" onClick={() => emit('goToProfile')}>
                {props.user.username}
              </h2>
              {props.user.admin ? (
                <span class="activity-view-header-card__badge is-admin">管理员</span>
              ) : props.user.moderator ? (
                <span class="activity-view-header-card__badge is-moderator">版主</span>
              ) : null}
            </div>
            {props.user.name && (
              <div class="activity-view-header-card__subtitle">{props.user.name}</div>
            )}
            {props.user.title && (
              <div class="activity-view-header-card__title2">{props.user.title}</div>
            )}
          </div>
        </div>

        <UserTabs
          active="activity"
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={tab => emit('switchMainTab', tab)}
        />

        <div class="activity-subtabs">
          {visibleTabs.value.map(tab => (
            <button
              key={tab.key}
              class={[
                'activity-subtabs__item',
                props.activityState.activeTab === tab.key ? 'is-active' : ''
              ]}
              onClick={() => emit('switchTab', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div class="activity-content">
          {['all', 'replies', 'likes'].includes(props.activityState.activeTab) && (
            <div class="activity-list">
              {props.activityState.actions.map(action => (
                <div
                  key={`${action.action_type}-${action.post_id ?? 'na'}-${action.created_at}`}
                  class="activity-item"
                  onClick={() => emit('openTopic', { id: action.topic_id, slug: action.slug })}
                >
                  <div class="activity-item__main">
                    <img
                      src={getAvatarUrl(action.avatar_template, props.baseUrl, 40)}
                      alt={action.username}
                      class="activity-item__avatar"
                      onClick={(e: Event) => {
                        e.stopPropagation()
                        emit('openUser', action.username)
                      }}
                    />
                    <div class="activity-item__body">
                      <div class="activity-item__meta">
                        <span
                          class="activity-item__actor"
                          onClick={(e: Event) => {
                            e.stopPropagation()
                            emit('openUser', action.username)
                          }}
                        >
                          {action.name || action.username}
                        </span>
                        <span>{getActionTypeLabel(action.action_type)}</span>
                        <span class="activity-item__time">{formatTime(action.created_at)}</span>
                      </div>
                      <div class="activity-item__title" innerHTML={action.title} />
                      {action.excerpt && (
                        <div
                          class="activity-item__excerpt line-clamp-2"
                          innerHTML={action.excerpt}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {props.activityState.actions.length === 0 && !props.isLoadingMore && (
                <div class="activity-state-empty">暂无数据</div>
              )}
            </div>
          )}

          {['topics', 'assigned', 'votes', 'portfolio', 'read'].includes(
            props.activityState.activeTab
          ) && (
            <div class="activity-list">
              {props.activityState.topics.map(topic => (
                <div
                  key={topic.id}
                  class="activity-topic-item"
                  onClick={() => emit('openTopic', topic)}
                >
                  <div
                    class="activity-topic-item__title"
                    innerHTML={topic.fancy_title || topic.title}
                  />
                  <div class="activity-topic-item__meta">
                    <span>{topic.posts_count} 帖子</span>
                    <span>{topic.views} 浏览</span>
                    <span>{topic.like_count} 赞</span>
                    {(topic as any).vote_count && <span>{(topic as any).vote_count} 票</span>}
                    {(topic as any).assigned_to_user && (
                      <span class="activity-topic-item__assignee">
                        指定给：{(topic as any).assigned_to_user.username}
                      </span>
                    )}
                    <span>{formatTime(topic.created_at)}</span>
                  </div>
                </div>
              ))}

              {props.activityState.topics.length === 0 && !props.isLoadingMore && (
                <div class="activity-state-empty">{emptyTopicsText.value}</div>
              )}
            </div>
          )}

          {props.activityState.activeTab === 'reactions' && (
            <div class="activity-list">
              {props.activityState.reactions.map(reaction => (
                <div
                  key={reaction.id}
                  class="activity-item"
                  onClick={() =>
                    emit('openTopic', {
                      id: reaction.post.topic_id,
                      slug: reaction.post.topic_slug
                    })
                  }
                >
                  <div class="activity-item__main">
                    <img
                      src={getAvatarUrl(reaction.post.avatar_template, props.baseUrl, 40)}
                      alt={reaction.post.username}
                      class="activity-item__avatar"
                      onClick={(e: Event) => {
                        e.stopPropagation()
                        emit('openUser', reaction.post.username)
                      }}
                    />
                    <div class="activity-item__body">
                      <div class="activity-item__meta">
                        <span class="activity-item__reaction-emoji">
                          {reaction.reaction.reaction_value === '+1'
                            ? '👍'
                            : reaction.reaction.reaction_value}
                        </span>
                        <span>反应于</span>
                        <span
                          class="activity-item__actor"
                          onClick={(e: Event) => {
                            e.stopPropagation()
                            emit('openUser', reaction.post.username)
                          }}
                        >
                          {reaction.post.name || reaction.post.username}
                        </span>
                        <span class="activity-item__time">{formatTime(reaction.created_at)}</span>
                      </div>
                      <div class="activity-item__title" innerHTML={reaction.post.topic_title} />
                      {reaction.post.excerpt && (
                        <div
                          class="activity-item__excerpt line-clamp-2"
                          innerHTML={reaction.post.excerpt}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {props.activityState.reactions.length === 0 && !props.isLoadingMore && (
                <div class="activity-state-empty">暂无反应</div>
              )}
            </div>
          )}

          {props.activityState.activeTab === 'solved' && (
            <div class="activity-list">
              {props.activityState.solvedPosts.map(post => (
                <div
                  key={post.post_id}
                  class="activity-item"
                  onClick={() => emit('openTopic', { id: post.topic_id, slug: post.slug })}
                >
                  <div class="activity-item__main">
                    <img
                      src={getAvatarUrl(post.avatar_template, props.baseUrl, 40)}
                      alt={post.username}
                      class="activity-item__avatar"
                    />
                    <div class="activity-item__body">
                      <div class="activity-item__meta">
                        <span class="activity-item__solved">✓ 已解决</span>
                        <span class="activity-item__time">{formatTime(post.created_at)}</span>
                      </div>
                      <div class="activity-item__title" innerHTML={post.topic_title} />
                      {post.excerpt && (
                        <div class="activity-item__excerpt line-clamp-2" innerHTML={post.excerpt} />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {props.activityState.solvedPosts.length === 0 && !props.isLoadingMore && (
                <div class="activity-state-empty">暂无已解决问题</div>
              )}
            </div>
          )}

          {props.isLoadingMore && (
            <div class="activity-state-loading">
              <Spin />
              <span>加载更多...</span>
            </div>
          )}

          {!props.activityState.hasMore && !props.isLoadingMore && (
            <div class="activity-state-end">已加载全部</div>
          )}
        </div>
      </div>
    )
  }
})
