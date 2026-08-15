import { computed, defineComponent, type PropType } from 'vue'

import type { DiscourseFollowPost, DiscourseUserProfile } from '../types'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import { formatTime, getAvatarUrl } from '../utils'
import { getDiscourseIconHref } from '../layout/iconSprite'
import { shouldFilterBlockedContent } from '../blocked'

import UserTabs from './UserTabs'
import type { UserMainTab } from './UserTabs'
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
    loading: { type: Boolean, default: false },
    showSettings: { type: Boolean, default: false },
    showGroups: { type: Boolean, default: true },
    blockedUsernames: { type: Array as () => string[], default: () => [] },
    exemptUsername: { type: String as PropType<string | null>, default: null }
  },
  emits: ['switchTab', 'switchMainTab', 'openUser', 'openTopic', 'goToProfile'],
  setup(props, { emit }) {
    const visibleFollowFeed = computed(() =>
      (props.user._follow_feed || []).filter(
        post =>
          !shouldFilterBlockedContent(
            props.blockedUsernames,
            post.user.username,
            props.exemptUsername
          )
      )
    )
    const visibleFollowing = computed(() =>
      (props.user._following || []).filter(
        user =>
          !shouldFilterBlockedContent(props.blockedUsernames, user.username, props.exemptUsername)
      )
    )
    const visibleFollowers = computed(() =>
      (props.user._followers || []).filter(
        user =>
          !shouldFilterBlockedContent(props.blockedUsernames, user.username, props.exemptUsername)
      )
    )

    return () => (
      <div class="user-extras">
        <UserTabs
          active={props.tab === 'badges' ? 'badges' : 'follow'}
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={(tab: UserMainTab) => emit('switchMainTab', tab)}
        />

        <div class="user-extras-toolbar">
          <div class="user-extras-subtabs">
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

        {props.loading && <div class="user-extras-state-loading">加载中...</div>}

        {!props.loading && props.tab === 'badges' && (
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
                    ) : badge.icon ? (
                      <svg class="user-extras-badge-item__icon" aria-hidden="true">
                        <use href={getDiscourseIconHref(badge.icon)} />
                      </svg>
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

        {!props.loading && props.tab === 'followFeed' && (
          <section class="user-extras-card">
            {visibleFollowFeed.value.length === 0 ? (
              <div class="user-extras-empty">暂无关注动态</div>
            ) : (
              <div class="user-extras-feed-list">
                {visibleFollowFeed.value.map(post => (
                  <div key={post.id} class="user-extras-feed-item">
                    <div class="user-extras-feed-item__meta">
                      {formatTime(post.created_at)} · @{post.user.username}
                    </div>
                    <div
                      class="user-extras-feed-item__title"
                      data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(post.topic.slug)}/${post.topic.id}/${post.post_number}`}
                      innerHTML={sanitizeDiscourseHtml(post.topic.fancy_title || post.topic.title)}
                      onClick={() => emit('openTopic', post.topic)}
                    />
                    <div
                      class="user-extras-feed-item__excerpt"
                      innerHTML={sanitizeDiscourseHtml(post.cooked || post.excerpt || '')}
                    />
                  </div>
                ))}
                {props.isLoadingMore && (
                  <div class="user-extras-state-loading">加载更多动态...</div>
                )}
                {props.hasMore === false && visibleFollowFeed.value.length > 0 && (
                  <div class="user-extras-state-end">已加载全部动态</div>
                )}
              </div>
            )}
          </section>
        )}

        {props.tab === 'following' && (
          <section class="user-extras-card">
            {visibleFollowing.value.length === 0 ? (
              <div class="user-extras-empty">暂无关注</div>
            ) : (
              <div class="user-extras-user-grid">
                {visibleFollowing.value.map(u => (
                  <div
                    key={u.id}
                    class="user-extras-user-item"
                    data-user-card={u.username}
                    data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(u.username)}`}
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
            {visibleFollowers.value.length === 0 ? (
              <div class="user-extras-empty">暂无关注者</div>
            ) : (
              <div class="user-extras-user-grid">
                {visibleFollowers.value.map(u => (
                  <div
                    key={u.id}
                    class="user-extras-user-item"
                    data-user-card={u.username}
                    data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(u.username)}`}
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
