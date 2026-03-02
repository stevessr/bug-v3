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
      <div class="user-extras">
        <UserTabs
          active={props.tab === 'badges' ? 'badges' : 'follow'}
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={(
            tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
          ) => emit('switchMainTab', tab)}
        />

        <div class="user-extras-toolbar">
          <div class="user-extras-subtabs">
            <button
              class={['user-extras-subtabs__item', props.tab === 'badges' ? 'is-active' : '']}
              onClick={() => emit('switchTab', 'badges')}
            >
              徽章
            </button>
            <button
              class={['user-extras-subtabs__item', props.tab === 'followFeed' ? 'is-active' : '']}
              onClick={() => emit('switchTab', 'followFeed')}
            >
              关注动态
            </button>
            <button
              class={['user-extras-subtabs__item', props.tab === 'following' ? 'is-active' : '']}
              onClick={() => emit('switchTab', 'following')}
            >
              正在关注
            </button>
            <button
              class={['user-extras-subtabs__item', props.tab === 'followers' ? 'is-active' : '']}
              onClick={() => emit('switchTab', 'followers')}
            >
              关注者
            </button>
          </div>
          <button class="user-extras-back-btn" onClick={() => emit('goToProfile')}>
            返回主页
          </button>
        </div>

        {props.tab === 'badges' && (
          <section class="user-extras-card">
            {!props.user._badges || props.user._badges.length === 0 ? (
              <div class="user-extras-empty">暂无徽章</div>
            ) : (
              <div class="user-extras-badge-grid">
                {props.user._badges.map(badge => (
                  <div
                    key={badge.id}
                    class="user-extras-badge-item"
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
                        class="user-extras-badge-item__image"
                      />
                    ) : (
                      <div class="user-extras-badge-item__placeholder" />
                    )}
                    <div class="user-extras-badge-item__name">{badge.name}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {props.tab === 'followFeed' && (
          <section class="user-extras-card">
            {!props.user._follow_feed || props.user._follow_feed.length === 0 ? (
              <div class="user-extras-empty">暂无关注动态</div>
            ) : (
              <div class="user-extras-feed-list">
                {props.user._follow_feed.map(post => (
                  <div key={post.id} class="user-extras-feed-item">
                    <div class="user-extras-feed-item__meta">
                      {formatTime(post.created_at)} · @{post.user.username}
                    </div>
                    <div
                      class="user-extras-feed-item__title"
                      innerHTML={post.topic.fancy_title || post.topic.title}
                      onClick={() => emit('openTopic', post.topic)}
                    />
                    <div class="user-extras-feed-item__excerpt">{post.excerpt}</div>
                  </div>
                ))}
                {props.isLoadingMore && (
                  <div class="user-extras-state-loading">加载更多动态...</div>
                )}
                {props.hasMore === false && <div class="user-extras-state-end">已加载全部动态</div>}
              </div>
            )}
          </section>
        )}

        {props.tab === 'following' && (
          <section class="user-extras-card">
            {!props.user._following || props.user._following.length === 0 ? (
              <div class="user-extras-empty">暂无关注</div>
            ) : (
              <div class="user-extras-user-grid">
                {props.user._following.map(u => (
                  <div
                    key={u.id}
                    class="user-extras-user-item"
                    onClick={() => emit('openUser', u.username)}
                  >
                    <img
                      src={getAvatarUrl(u.avatar_template, props.baseUrl, 32)}
                      alt={u.username}
                      class="user-extras-user-item__avatar"
                    />
                    <span class="user-extras-user-item__name">{u.name || u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {props.tab === 'followers' && (
          <section class="user-extras-card">
            {!props.user._followers || props.user._followers.length === 0 ? (
              <div class="user-extras-empty">暂无关注者</div>
            ) : (
              <div class="user-extras-user-grid">
                {props.user._followers.map(u => (
                  <div
                    key={u.id}
                    class="user-extras-user-item"
                    onClick={() => emit('openUser', u.username)}
                  >
                    <img
                      src={getAvatarUrl(u.avatar_template, props.baseUrl, 32)}
                      alt={u.username}
                      class="user-extras-user-item__avatar"
                    />
                    <span class="user-extras-user-item__name">{u.name || u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    )
  }
})
