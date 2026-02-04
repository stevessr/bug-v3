import { defineComponent } from 'vue'

import type { DiscourseFollowPost, DiscourseUserProfile } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import UserTabs from './UserTabs'
import '../css/UserExtrasView.css'

type ExtrasTab = 'badges' | 'followFeed' | 'following' | 'followers'

export default defineComponent({
  name: 'UserExtrasView',
  props: {
    user: {
      type: Object as () => DiscourseUserProfile & {
        _badges?: Array<{
          id: number
          name: string
          description?: string
          image_url?: string
          icon?: string
        }>
        _follow_feed?: DiscourseFollowPost[]
        _following?: Array<{
          id: number
          username: string
          name?: string
          avatar_template: string
        }>
        _followers?: Array<{
          id: number
          username: string
          name?: string
          avatar_template: string
        }>
      },
      required: true
    },
    baseUrl: { type: String, required: true },
    tab: { type: String as () => ExtrasTab, required: true },
    isLoadingMore: { type: Boolean, default: false },
    hasMore: { type: Boolean, default: false },
    showSettings: { type: Boolean, default: false },
    showGroups: { type: Boolean, default: true }
  },
  emits: ['switchTab', 'switchMainTab', 'openUser', 'openTopic', 'goToProfile'],
  setup(props, { emit }) {
    return () => (
      <div class="user-extras space-y-4">
        <UserTabs
          active={props.tab === 'badges' ? 'badges' : 'follow'}
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={(
            tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
          ) => emit('switchMainTab', tab)}
        />

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              class={[
                'px-3 py-1 text-sm rounded border dark:border-gray-700',
                props.tab === 'badges' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'
              ]}
              onClick={() => emit('switchTab', 'badges')}
            >
              徽章
            </button>
            <button
              class={[
                'px-3 py-1 text-sm rounded border dark:border-gray-700',
                props.tab === 'followFeed' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'
              ]}
              onClick={() => emit('switchTab', 'followFeed')}
            >
              关注动态
            </button>
            <button
              class={[
                'px-3 py-1 text-sm rounded border dark:border-gray-700',
                props.tab === 'following' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'
              ]}
              onClick={() => emit('switchTab', 'following')}
            >
              正在关注
            </button>
            <button
              class={[
                'px-3 py-1 text-sm rounded border dark:border-gray-700',
                props.tab === 'followers' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'
              ]}
              onClick={() => emit('switchTab', 'followers')}
            >
              关注者
            </button>
          </div>
          <button
            class="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => emit('goToProfile')}
          >
            返回主页
          </button>
        </div>

        {props.tab === 'badges' && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            {!props.user._badges || props.user._badges.length === 0 ? (
              <div class="text-sm text-gray-500">暂无徽章</div>
            ) : (
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {props.user._badges.map(badge => (
                  <div
                    key={badge.id}
                    class="flex items-center gap-2 p-2 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700"
                    title={badge.description || badge.name}
                  >
                    {badge.image_url ? (
                      <img
                        src={
                          badge.image_url.startsWith('http')
                            ? badge.image_url
                            : `${props.baseUrl}${badge.image_url}`
                        }
                        alt={badge.name}
                        class="w-8 h-8 rounded"
                      />
                    ) : (
                      <div class="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700" />
                    )}
                    <div class="text-xs dark:text-gray-300 truncate">{badge.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {props.tab === 'followFeed' && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            {!props.user._follow_feed || props.user._follow_feed.length === 0 ? (
              <div class="text-sm text-gray-500">暂无关注动态</div>
            ) : (
              <div class="space-y-3">
                {props.user._follow_feed.map(post => (
                  <div
                    key={post.id}
                    class="p-3 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700"
                  >
                    <div class="text-xs text-gray-500 mb-1">
                      {formatTime(post.created_at)} · @{post.user.username}
                    </div>
                    <div
                      class="text-sm dark:text-gray-300 cursor-pointer hover:text-blue-500"
                      innerHTML={post.topic.fancy_title || post.topic.title}
                      onClick={() => emit('openTopic', post.topic)}
                    />
                    <div class="text-xs text-gray-500 mt-1 whitespace-pre-line">{post.excerpt}</div>
                  </div>
                ))}
                {props.isLoadingMore && (
                  <div class="text-sm text-gray-500 text-center py-2">加载更多动态...</div>
                )}
                {props.hasMore === false && (
                  <div class="text-xs text-gray-400 text-center py-2">已加载全部动态</div>
                )}
              </div>
            )}
          </div>
        )}

        {props.tab === 'following' && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            {!props.user._following || props.user._following.length === 0 ? (
              <div class="text-sm text-gray-500">暂无关注</div>
            ) : (
              <div class="flex flex-wrap gap-2">
                {props.user._following.map(u => (
                  <div
                    key={u.id}
                    class="flex items-center gap-2 px-2 py-1 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700 cursor-pointer"
                    onClick={() => emit('openUser', u.username)}
                  >
                    <img
                      src={getAvatarUrl(u.avatar_template, props.baseUrl, 32)}
                      alt={u.username}
                      class="w-6 h-6 rounded-full"
                    />
                    <span class="text-xs dark:text-gray-300">{u.name || u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {props.tab === 'followers' && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            {!props.user._followers || props.user._followers.length === 0 ? (
              <div class="text-sm text-gray-500">暂无关注者</div>
            ) : (
              <div class="flex flex-wrap gap-2">
                {props.user._followers.map(u => (
                  <div
                    key={u.id}
                    class="flex items-center gap-2 px-2 py-1 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700 cursor-pointer"
                    onClick={() => emit('openUser', u.username)}
                  >
                    <img
                      src={getAvatarUrl(u.avatar_template, props.baseUrl, 32)}
                      alt={u.username}
                      class="w-6 h-6 rounded-full"
                    />
                    <span class="text-xs dark:text-gray-300">{u.name || u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
})
