import { defineComponent, computed } from 'vue'
import { Spin } from 'ant-design-vue'

import type {
  DiscourseUserProfile,
  UserActivityState,
  DiscourseUserAction,
  DiscourseTopic,
  DiscourseReaction,
  DiscourseSolvedPost,
  ActivityTabType
} from '../types'
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
    showReadTab: { type: Boolean, default: false }
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
      <div class="activity-view space-y-4">
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
              {props.user.admin ? (
                <span class="px-2 py-0.5 text-xs bg-red-500 text-white rounded">管理员</span>
              ) : props.user.moderator ? (
                <span class="px-2 py-0.5 text-xs bg-blue-500 text-white rounded">版主</span>
              ) : null}
            </div>
            {props.user.name && <div class="text-sm text-gray-500">{props.user.name}</div>}
            {props.user.title && (
              <div class="text-sm text-yellow-600 dark:text-yellow-400">{props.user.title}</div>
            )}
          </div>
        </div>

        <UserTabs active="activity" onSwitchTab={tab => emit('switchMainTab', tab)} />

        {/* Tab navigation */}
        <div class="flex gap-1 overflow-x-auto border-b dark:border-gray-700 pb-1">
          {visibleTabs.value.map(tab => (
            <button
              key={tab.key}
              class={[
                'px-4 py-2 text-sm rounded-t whitespace-nowrap transition-colors',
                props.activityState.activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              ]}
              onClick={() => emit('switchTab', tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content based on active tab */}
        <div class="activity-content">
          {['all', 'replies', 'likes'].includes(props.activityState.activeTab) && (
            <div class="space-y-2">
              {props.activityState.actions.map(action => (
                <div
                  key={`${action.action_type}-${action.post_id}`}
                  class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                  onClick={() => emit('openTopic', { id: action.topic_id, slug: action.slug })}
                >
                  <div class="flex items-start gap-3">
                    <img
                      src={getAvatarUrl(action.avatar_template, props.baseUrl, 40)}
                      alt={action.username}
                      class="w-10 h-10 rounded-full flex-shrink-0"
                      onClick={(e: Event) => {
                        e.stopPropagation()
                        emit('openUser', action.username)
                      }}
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <span
                          class="font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 cursor-pointer"
                          onClick={(e: Event) => {
                            e.stopPropagation()
                            emit('openUser', action.username)
                          }}
                        >
                          {action.name || action.username}
                        </span>
                        <span>{getActionTypeLabel(action.action_type)}</span>
                        <span class="text-gray-400">{formatTime(action.created_at)}</span>
                      </div>
                      <div class="font-medium dark:text-white truncate" innerHTML={action.title} />
                      {action.excerpt && (
                        <div
                          class="text-sm text-gray-500 mt-1 line-clamp-2"
                          innerHTML={action.excerpt}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {props.activityState.actions.length === 0 && !props.isLoadingMore && (
                <div class="text-center text-gray-400 py-8">暂无数据</div>
              )}
            </div>
          )}

          {['topics', 'assigned', 'votes', 'portfolio', 'read'].includes(
            props.activityState.activeTab
          ) && (
            <div class="space-y-2">
              {props.activityState.topics.map(topic => (
                <div
                  key={topic.id}
                  class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                  onClick={() => emit('openTopic', topic)}
                >
                  <div
                    class="font-medium dark:text-white"
                    innerHTML={topic.fancy_title || topic.title}
                  />
                  <div class="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span>{topic.posts_count} 帖子</span>
                    <span>{topic.views} 浏览</span>
                    <span>{topic.like_count} 赞</span>
                    {(topic as any).vote_count && <span>{(topic as any).vote_count} 票</span>}
                    {(topic as any).assigned_to_user && (
                      <span class="text-blue-500">
                        指定给：{(topic as any).assigned_to_user.username}
                      </span>
                    )}
                    <span>{formatTime(topic.created_at)}</span>
                  </div>
                </div>
              ))}

              {props.activityState.topics.length === 0 && !props.isLoadingMore && (
                <div class="text-center text-gray-400 py-8">{emptyTopicsText.value}</div>
              )}
            </div>
          )}

          {props.activityState.activeTab === 'reactions' && (
            <div class="space-y-2">
              {props.activityState.reactions.map(reaction => (
                <div
                  key={reaction.id}
                  class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                  onClick={() =>
                    emit('openTopic', {
                      id: reaction.post.topic_id,
                      slug: reaction.post.topic_slug
                    })
                  }
                >
                  <div class="flex items-start gap-3">
                    <img
                      src={getAvatarUrl(reaction.post.avatar_template, props.baseUrl, 40)}
                      alt={reaction.post.username}
                      class="w-10 h-10 rounded-full flex-shrink-0"
                      onClick={(e: Event) => {
                        e.stopPropagation()
                        emit('openUser', reaction.post.username)
                      }}
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <span class="text-lg">
                          {reaction.reaction.reaction_value === '+1'
                            ? '👍'
                            : reaction.reaction.reaction_value}
                        </span>
                        <span>反应于</span>
                        <span
                          class="font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 cursor-pointer"
                          onClick={(e: Event) => {
                            e.stopPropagation()
                            emit('openUser', reaction.post.username)
                          }}
                        >
                          {reaction.post.name || reaction.post.username}
                        </span>
                        <span class="text-gray-400">{formatTime(reaction.created_at)}</span>
                      </div>
                      <div
                        class="font-medium dark:text-white truncate"
                        innerHTML={reaction.post.topic_html_title || reaction.post.topic_title}
                      />
                      {reaction.post.excerpt && (
                        <div
                          class="text-sm text-gray-500 mt-1 line-clamp-2"
                          innerHTML={reaction.post.excerpt}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {props.activityState.reactions.length === 0 && !props.isLoadingMore && (
                <div class="text-center text-gray-400 py-8">暂无反应</div>
              )}
            </div>
          )}

          {props.activityState.activeTab === 'solved' && (
            <div class="space-y-2">
              {props.activityState.solvedPosts.map(post => (
                <div
                  key={post.post_id}
                  class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
                  onClick={() => emit('openTopic', { id: post.topic_id, slug: post.slug })}
                >
                  <div class="flex items-start gap-3">
                    <img
                      src={getAvatarUrl(post.avatar_template, props.baseUrl, 40)}
                      alt={post.username}
                      class="w-10 h-10 rounded-full flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <span class="text-green-500">✓ 已解决</span>
                        <span class="text-gray-400">{formatTime(post.created_at)}</span>
                      </div>
                      <div
                        class="font-medium dark:text-white truncate"
                        innerHTML={post.topic_title}
                      />
                      {post.excerpt && (
                        <div
                          class="text-sm text-gray-500 mt-1 line-clamp-2"
                          innerHTML={post.excerpt}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {props.activityState.solvedPosts.length === 0 && !props.isLoadingMore && (
                <div class="text-center text-gray-400 py-8">暂无已解决问题</div>
              )}
            </div>
          )}

          {props.isLoadingMore && (
            <div class="flex items-center justify-center py-4">
              <Spin />
              <span class="ml-2 text-gray-500">加载更多...</span>
            </div>
          )}

          {!props.activityState.hasMore && !props.isLoadingMore && (
            <div class="text-center text-gray-400 py-4 text-sm">已加载全部</div>
          )}
        </div>
      </div>
    )
  }
})
