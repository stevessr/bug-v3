import { defineComponent } from 'vue'

import type { DiscourseFollowPost, DiscourseUserProfile } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import UserTabs from './UserTabs'
import '../css/UserView.css'

export default defineComponent({
  name: 'UserView',
  props: {
    user: {
      type: Object as () => DiscourseUserProfile & {
        _summary?: {
          likes_given: number
          likes_received: number
          topics_entered: number
          posts_read_count: number
          days_visited: number
          topic_count: number
          post_count: number
          time_read: number
          solved_count?: number
          top_categories?: Array<{
            id: number
            name: string
            color: string
            slug: string
            topic_count: number
            post_count: number
          }>
        }
        _topics?: Array<{
          id: number
          title: string
          fancy_title: string
          slug: string
          posts_count: number
          like_count: number
        }>
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
    showSettings: { type: Boolean, default: false },
    showGroups: { type: Boolean, default: true }
  },
  emits: [
    'openTopic',
    'openActivity',
    'openMessages',
    'openUser',
    'openBadges',
    'openFollowFeed',
    'openFollowing',
    'openFollowers',
    'switchMainTab'
  ],
  setup(props, { emit }) {
    const formatTimeRead = (seconds: number): string => {
      if (!seconds) return '0 小时'
      const hours = Math.floor(seconds / 3600)
      if (hours < 24) return `${hours} 小时`
      const days = Math.floor(hours / 24)
      return `${days} 天 ${hours % 24} 小时`
    }

    const getTrustLevelName = (level: number): string => {
      const names: Record<number, string> = {
        0: '新用户',
        1: '基本用户',
        2: '成员',
        3: '活跃用户',
        4: '领导者'
      }
      return names[level] || `等级 ${level}`
    }

    return () => (
      <div class="user-profile space-y-6">
        <div
          class="user-header relative rounded-lg overflow-hidden"
          style={{
            backgroundImage: props.user.card_background_upload_url
              ? `url(${props.baseUrl}${props.user.card_background_upload_url})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div class="bg-black/40 p-6">
            <div class="flex items-start gap-4">
              <img
                src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 120)}
                alt={props.user.username}
                class="w-24 h-24 rounded-full border-4 border-white shadow-lg"
              />

              <div class="flex-1 text-white">
                <div class="flex items-center gap-2">
                  <h1 class="text-2xl font-bold">{props.user.username}</h1>
                  {props.user.admin ? (
                    <span class="px-2 py-0.5 text-xs bg-red-500 rounded">管理员</span>
                  ) : props.user.moderator ? (
                    <span class="px-2 py-0.5 text-xs bg-blue-500 rounded">版主</span>
                  ) : null}
                </div>

                {props.user.name && <div class="text-sm opacity-80">{props.user.name}</div>}

                {props.user.title && (
                  <div class="text-sm mt-1 text-yellow-300">{props.user.title}</div>
                )}

                {props.user.status && (
                  <div class="flex items-center gap-1 mt-2 text-sm">
                    <span>{props.user.status.emoji}</span>
                    <span>{props.user.status.description}</span>
                  </div>
                )}

                <div class="flex items-center gap-4 mt-2 text-sm opacity-80">
                  <span>{getTrustLevelName(props.user.trust_level)}</span>
                  {props.user.location && <span>📍 {props.user.location}</span>}
                  {props.user.website && (
                    <span>
                      <a
                        href={props.user.website}
                        target="_blank"
                        rel="noopener"
                        class="hover:underline"
                      >
                        🔗 {props.user.website_name || props.user.website}
                      </a>
                    </span>
                  )}
                </div>

                <div class="mt-3 text-sm opacity-80">用户概览</div>
              </div>
            </div>
          </div>
        </div>

        <UserTabs
          active="summary"
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={tab => emit('switchMainTab', tab)}
        />

        {props.user.bio_cooked && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <h3 class="text-sm font-semibold mb-2 dark:text-white">个人简介</h3>
            <div
              class="user-bio-content prose dark:prose-invert max-w-none text-sm"
              innerHTML={props.user.bio_cooked}
            />
          </div>
        )}

        {props.user._summary && (
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-blue-500">{props.user._summary.topic_count}</div>
              <div class="text-xs text-gray-500">发布话题</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-green-500">{props.user._summary.post_count}</div>
              <div class="text-xs text-gray-500">发布帖子</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-red-500">
                {props.user._summary.likes_received}
              </div>
              <div class="text-xs text-gray-500">收到赞</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-purple-500">
                {props.user._summary.likes_given}
              </div>
              <div class="text-xs text-gray-500">送出赞</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-orange-500">
                {props.user._summary.days_visited}
              </div>
              <div class="text-xs text-gray-500">访问天数</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-cyan-500">
                {formatTimeRead(props.user._summary.time_read)}
              </div>
              <div class="text-xs text-gray-500">阅读时间</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
              <div class="text-2xl font-bold text-pink-500">
                {props.user._summary.topics_entered}
              </div>
              <div class="text-xs text-gray-500">浏览话题</div>
            </div>
            {props.user._summary.solved_count && (
              <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center">
                <div class="text-2xl font-bold text-emerald-500">
                  {props.user._summary.solved_count}
                </div>
                <div class="text-xs text-gray-500">解决问题</div>
              </div>
            )}
          </div>
        )}

        {props.user.featured_topic && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <h3 class="text-sm font-semibold mb-2 dark:text-white">置顶话题</h3>
            <div
              class="cursor-pointer hover:text-blue-500 dark:text-gray-300"
              onClick={() => emit('openTopic', props.user.featured_topic!)}
            >
              <span
                innerHTML={props.user.featured_topic.fancy_title || props.user.featured_topic.title}
              />
              <span class="text-xs text-gray-500 ml-2">
                ({props.user.featured_topic.posts_count} 帖子)
              </span>
            </div>
          </div>
        )}

        {props.user._summary?.top_categories && props.user._summary.top_categories.length > 0 && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <h3 class="text-sm font-semibold mb-3 dark:text-white">活跃分类</h3>
            <div class="space-y-2">
              {props.user._summary.top_categories.slice(0, 5).map(cat => (
                <div key={cat.id} class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded" style={{ backgroundColor: `#${cat.color}` }} />
                    <span class="text-sm dark:text-gray-300">{cat.name}</span>
                  </div>
                  <div class="text-xs text-gray-500">
                    {cat.topic_count} 话题 · {cat.post_count} 帖子
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {props.user._topics && props.user._topics.length > 0 && (
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <h3 class="text-sm font-semibold mb-3 dark:text-white">热门话题</h3>
            <div class="space-y-2">
              {props.user._topics.slice(0, 6).map(topic => (
                <div
                  key={topic.id}
                  class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => emit('openTopic', topic)}
                >
                  <div
                    class="text-sm dark:text-gray-300 truncate"
                    innerHTML={topic.fancy_title || topic.title}
                  />
                  <div class="text-xs text-gray-500 mt-1">
                    {topic.posts_count} 帖子 · {topic.like_count} 赞
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
          <h3 class="text-sm font-semibold mb-2 dark:text-white">账户信息</h3>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-gray-500">注册时间</div>
            <div class="dark:text-gray-300">{formatTime(props.user.created_at)}</div>
            {props.user.last_seen_at && (
              <>
                <div class="text-gray-500">最后在线</div>
                <div class="dark:text-gray-300">{formatTime(props.user.last_seen_at)}</div>
              </>
            )}
            {props.user.last_posted_at && (
              <>
                <div class="text-gray-500">最后发帖</div>
                <div class="dark:text-gray-300">{formatTime(props.user.last_posted_at)}</div>
              </>
            )}
            {props.user.profile_view_count && (
              <>
                <div class="text-gray-500">主页浏览</div>
                <div class="dark:text-gray-300">{props.user.profile_view_count} 次</div>
              </>
            )}
            {props.user.badge_count && (
              <>
                <div class="text-gray-500">徽章数量</div>
                <div class="dark:text-gray-300">{props.user.badge_count} 个</div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }
})
