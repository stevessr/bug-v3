import { defineComponent, computed } from 'vue'
import { Spin } from 'ant-design-vue'

import type { DiscourseUserProfile, UserActivityState, ActivityTabType } from '../types'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
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
    const handleKeyboardOpen = (event: KeyboardEvent, action: () => void) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      action()
    }

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
        <header class="activity-view-header-card">
          <button
            type="button"
            class="activity-view-header-card__avatar-button"
            aria-label={`打开 ${props.user.username} 的主页`}
            onClick={() => emit('goToProfile')}
          >
            <img
              src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 64)}
              alt=""
              class="activity-view-header-card__avatar"
            />
          </button>
          <div class="activity-view-header-card__info">
            <div class="activity-view-header-card__title-row">
              <button
                type="button"
                class="activity-view-header-card__title"
                onClick={() => emit('goToProfile')}
              >
                {props.user.username}
              </button>
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
        </header>

        <UserTabs
          active="activity"
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={tab => emit('switchMainTab', tab)}
        />

        <div class="activity-subtabs" role="tablist" aria-label="动态类型">
          {visibleTabs.value.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              class={[
                'activity-subtabs__item',
                props.activityState.activeTab === tab.key ? 'is-active' : ''
              ]}
              aria-selected={props.activityState.activeTab === tab.key}
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
                <article
                  key={`${action.action_type}-${action.post_id ?? 'na'}-${action.created_at}`}
                  class="activity-item"
                >
                  <div class="activity-item__main">
                    <button
                      type="button"
                      class="activity-item__avatar-button"
                      data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(action.username)}`}
                      aria-label={`打开 ${action.username} 的主页`}
                      onClick={() => emit('openUser', action.username)}
                    >
                      <img
                        src={getAvatarUrl(action.avatar_template, props.baseUrl, 40)}
                        alt=""
                        class="activity-item__avatar"
                      />
                    </button>
                    <div
                      class="activity-item__body"
                      role="link"
                      tabindex={0}
                      data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(action.slug || String(action.topic_id))}/${action.topic_id}${action.post_number ? `/${action.post_number}` : ''}`}
                      onClick={() => emit('openTopic', { id: action.topic_id, slug: action.slug })}
                      onKeydown={(event: KeyboardEvent) =>
                        handleKeyboardOpen(event, () =>
                          emit('openTopic', { id: action.topic_id, slug: action.slug })
                        )
                      }
                    >
                      <div class="activity-item__meta">
                        <span class="activity-item__actor">{action.name || action.username}</span>
                        <span>{getActionTypeLabel(action.action_type)}</span>
                        <span class="activity-item__time">{formatTime(action.created_at)}</span>
                      </div>
                      <div
                        class="activity-item__title"
                        innerHTML={sanitizeDiscourseHtml(action.title)}
                      />
                      {action.excerpt && (
                        <div
                          class="activity-item__excerpt line-clamp-2"
                          innerHTML={sanitizeDiscourseHtml(action.excerpt)}
                        />
                      )}
                    </div>
                  </div>
                </article>
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
                <button
                  key={topic.id}
                  type="button"
                  class="activity-topic-item"
                  data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(topic.slug)}/${topic.id}`}
                  onClick={() => emit('openTopic', topic)}
                >
                  <div
                    class="activity-topic-item__title"
                    innerHTML={sanitizeDiscourseHtml(topic.fancy_title || topic.title)}
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
                </button>
              ))}

              {props.activityState.topics.length === 0 && !props.isLoadingMore && (
                <div class="activity-state-empty">{emptyTopicsText.value}</div>
              )}
            </div>
          )}

          {props.activityState.activeTab === 'reactions' && (
            <div class="activity-list">
              {props.activityState.reactions.map(reaction => (
                <article key={reaction.id} class="activity-item">
                  <div class="activity-item__main">
                    <button
                      type="button"
                      class="activity-item__avatar-button"
                      data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(reaction.post.username)}`}
                      aria-label={`打开 ${reaction.post.username} 的主页`}
                      onClick={() => emit('openUser', reaction.post.username)}
                    >
                      <img
                        src={getAvatarUrl(reaction.post.avatar_template, props.baseUrl, 40)}
                        alt=""
                        class="activity-item__avatar"
                      />
                    </button>
                    <div
                      class="activity-item__body"
                      role="link"
                      tabindex={0}
                      data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(reaction.post.topic_slug || String(reaction.post.topic_id))}/${reaction.post.topic_id}/${reaction.post.post_number}`}
                      onClick={() =>
                        emit('openTopic', {
                          id: reaction.post.topic_id,
                          slug: reaction.post.topic_slug
                        })
                      }
                      onKeydown={(event: KeyboardEvent) =>
                        handleKeyboardOpen(event, () =>
                          emit('openTopic', {
                            id: reaction.post.topic_id,
                            slug: reaction.post.topic_slug
                          })
                        )
                      }
                    >
                      <div class="activity-item__meta">
                        <span class="activity-item__reaction-emoji">
                          {reaction.reaction.reaction_value === '+1'
                            ? '👍'
                            : reaction.reaction.reaction_value}
                        </span>
                        <span>反应于</span>
                        <span class="activity-item__actor">
                          {reaction.post.name || reaction.post.username}
                        </span>
                        <span class="activity-item__time">{formatTime(reaction.created_at)}</span>
                      </div>
                      <div
                        class="activity-item__title"
                        innerHTML={sanitizeDiscourseHtml(reaction.post.topic_title)}
                      />
                      {reaction.post.excerpt && (
                        <div
                          class="activity-item__excerpt line-clamp-2"
                          innerHTML={sanitizeDiscourseHtml(reaction.post.excerpt)}
                        />
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {props.activityState.reactions.length === 0 && !props.isLoadingMore && (
                <div class="activity-state-empty">暂无反应</div>
              )}
            </div>
          )}

          {props.activityState.activeTab === 'solved' && (
            <div class="activity-list">
              {props.activityState.solvedPosts.map(post => (
                <article key={post.post_id} class="activity-item">
                  <div class="activity-item__main">
                    <img
                      src={getAvatarUrl(post.avatar_template, props.baseUrl, 40)}
                      alt={post.username}
                      class="activity-item__avatar"
                    />
                    <div
                      class="activity-item__body"
                      role="link"
                      tabindex={0}
                      data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(post.slug)}/${post.topic_id}/${post.post_number}`}
                      onClick={() => emit('openTopic', { id: post.topic_id, slug: post.slug })}
                      onKeydown={(event: KeyboardEvent) =>
                        handleKeyboardOpen(event, () =>
                          emit('openTopic', { id: post.topic_id, slug: post.slug })
                        )
                      }
                    >
                      <div class="activity-item__meta">
                        <span class="activity-item__solved">✓ 已解决</span>
                        <span class="activity-item__time">{formatTime(post.created_at)}</span>
                      </div>
                      <div
                        class="activity-item__title"
                        innerHTML={sanitizeDiscourseHtml(post.topic_title)}
                      />
                      {post.excerpt && (
                        <div
                          class="activity-item__excerpt line-clamp-2"
                          innerHTML={sanitizeDiscourseHtml(post.excerpt)}
                        />
                      )}
                    </div>
                  </div>
                </article>
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
