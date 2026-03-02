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
      <div class="user-profile">
        <div
          class="user-profile-header"
          style={{
            backgroundImage: props.user.card_background_upload_url
              ? `url(${props.baseUrl}${props.user.card_background_upload_url})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div class="user-profile-header__overlay">
            <div class="user-profile-header__main">
              <img
                src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 120)}
                alt={props.user.username}
                class="user-profile-header__avatar"
              />

              <div class="user-profile-header__info">
                <div class="user-profile-header__name-row">
                  <h1 class="user-profile-header__username">{props.user.username}</h1>
                  {props.user.admin ? (
                    <span class="user-profile-header__badge is-admin">管理员</span>
                  ) : props.user.moderator ? (
                    <span class="user-profile-header__badge is-moderator">版主</span>
                  ) : null}
                </div>

                {props.user.name && <div class="user-profile-header__name">{props.user.name}</div>}

                {props.user.title && (
                  <div class="user-profile-header__title">{props.user.title}</div>
                )}

                {props.user.status && (
                  <div class="user-profile-header__status">
                    <span>{props.user.status.emoji}</span>
                    <span>{props.user.status.description}</span>
                  </div>
                )}

                <div class="user-profile-header__meta-row">
                  <span>{getTrustLevelName(props.user.trust_level)}</span>
                  {props.user.location && <span>{props.user.location}</span>}
                  {props.user.website && (
                    <a
                      href={props.user.website}
                      target="_blank"
                      rel="noopener"
                      class="user-profile-link"
                    >
                      {props.user.website_name || props.user.website}
                    </a>
                  )}
                </div>

                <div class="user-profile-header__hint">用户概览</div>
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
          <section class="user-profile-card user-profile-card--bio">
            <h3 class="user-profile-card__title">个人简介</h3>
            <div class="user-bio-content" innerHTML={props.user.bio_cooked} />
          </section>
        )}

        {props.user._summary && (
          <section class="user-profile-stats-grid">
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-blue">
                {props.user._summary.topic_count}
              </div>
              <div class="user-profile-stat-card__label">发布话题</div>
            </div>
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-green">
                {props.user._summary.post_count}
              </div>
              <div class="user-profile-stat-card__label">发布帖子</div>
            </div>
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-red">
                {props.user._summary.likes_received}
              </div>
              <div class="user-profile-stat-card__label">收到赞</div>
            </div>
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-purple">
                {props.user._summary.likes_given}
              </div>
              <div class="user-profile-stat-card__label">送出赞</div>
            </div>
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-orange">
                {props.user._summary.days_visited}
              </div>
              <div class="user-profile-stat-card__label">访问天数</div>
            </div>
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-cyan">
                {formatTimeRead(props.user._summary.time_read)}
              </div>
              <div class="user-profile-stat-card__label">阅读时间</div>
            </div>
            <div class="user-profile-stat-card">
              <div class="user-profile-stat-card__value is-pink">
                {props.user._summary.topics_entered}
              </div>
              <div class="user-profile-stat-card__label">浏览话题</div>
            </div>
            {props.user._summary.solved_count && (
              <div class="user-profile-stat-card">
                <div class="user-profile-stat-card__value is-emerald">
                  {props.user._summary.solved_count}
                </div>
                <div class="user-profile-stat-card__label">解决问题</div>
              </div>
            )}
          </section>
        )}

        {props.user.featured_topic && (
          <section class="user-profile-card">
            <h3 class="user-profile-card__title">置顶话题</h3>
            <div
              class="user-profile-featured-topic"
              onClick={() => emit('openTopic', props.user.featured_topic)}
            >
              <span
                innerHTML={props.user.featured_topic.fancy_title || props.user.featured_topic.title}
              />
              <span class="user-profile-featured-topic__meta">
                ({props.user.featured_topic.posts_count} 帖子)
              </span>
            </div>
          </section>
        )}

        {props.user._summary?.top_categories && props.user._summary.top_categories.length > 0 && (
          <section class="user-profile-card">
            <h3 class="user-profile-card__title">活跃分类</h3>
            <div class="user-profile-category-list">
              {props.user._summary.top_categories.slice(0, 5).map(cat => (
                <div key={cat.id} class="user-profile-category-row">
                  <div class="user-profile-category-row__left">
                    <div
                      class="user-profile-category-row__dot"
                      style={{ backgroundColor: `#${cat.color}` }}
                    />
                    <span>{cat.name}</span>
                  </div>
                  <div class="user-profile-category-row__meta">
                    {cat.topic_count} 话题 · {cat.post_count} 帖子
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {props.user._topics && props.user._topics.length > 0 && (
          <section class="user-profile-card">
            <h3 class="user-profile-card__title">热门话题</h3>
            <div class="user-profile-topic-list">
              {props.user._topics.slice(0, 6).map(topic => (
                <div
                  key={topic.id}
                  class="user-profile-topic-item"
                  onClick={() => emit('openTopic', topic)}
                >
                  <div
                    class="user-profile-topic-item__title"
                    innerHTML={topic.fancy_title || topic.title}
                  />
                  <div class="user-profile-topic-item__meta">
                    {topic.posts_count} 帖子 · {topic.like_count} 赞
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section class="user-profile-card">
          <h3 class="user-profile-card__title">账户信息</h3>
          <div class="user-profile-account-grid">
            <div class="user-profile-account-grid__label">注册时间</div>
            <div>{formatTime(props.user.created_at)}</div>
            {props.user.last_seen_at && (
              <>
                <div class="user-profile-account-grid__label">最后在线</div>
                <div>{formatTime(props.user.last_seen_at)}</div>
              </>
            )}
            {props.user.last_posted_at && (
              <>
                <div class="user-profile-account-grid__label">最后发帖</div>
                <div>{formatTime(props.user.last_posted_at)}</div>
              </>
            )}
            {props.user.profile_view_count && (
              <>
                <div class="user-profile-account-grid__label">主页浏览</div>
                <div>{props.user.profile_view_count} 次</div>
              </>
            )}
            {props.user.badge_count && (
              <>
                <div class="user-profile-account-grid__label">徽章数量</div>
                <div>{props.user.badge_count} 个</div>
              </>
            )}
          </div>
        </section>
      </div>
    )
  }
})
