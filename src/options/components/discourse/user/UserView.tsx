import { computed, defineComponent, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { DiscourseCategory, DiscourseFollowPost, DiscourseUserProfile } from '../types'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import { formatTime, getAvatarUrl } from '../utils'
import { resolveDiscourseHttpUrl } from '../navigation'
import { setUserFollowed } from '../actions'
import { getDiscourseIconHref } from '../layout/iconSprite'
import TopicCategoryBadge from '../layout/TopicCategoryBadge'
import { normalizeCategoriesFromResponse } from '../routes/categories'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories
} from '../linux.do/preloadedCategories'

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
          category_id?: number
          category?: Partial<DiscourseCategory> | null
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
    'composeMessage',
    'startChat',
    'openCategory',
    'switchMainTab'
  ],
  setup(props, { emit }) {
    const followSaving = ref(false)
    const profileCategories = ref<DiscourseCategory[]>([])
    const isFollowed = computed(() => Boolean(props.user.is_followed))
    const profileBackground = computed(() => {
      const raw =
        props.user.profile_background_upload_url || props.user.card_background_upload_url || ''
      return raw ? resolveDiscourseHttpUrl(raw, props.baseUrl) : ''
    })
    const canMessage = computed(
      () =>
        !props.showSettings &&
        Boolean(props.user.can_send_private_message_to_user ?? props.user.can_send_private_messages)
    )
    const canChat = computed(() => !props.showSettings && props.user.can_chat_user === true)
    const canFollow = computed(
      () => !props.showSettings && Boolean(props.user.can_follow || props.user.is_followed)
    )

    const loadProfileCategories = async (baseUrl: string) => {
      if (!baseUrl) {
        profileCategories.value = []
        return
      }
      try {
        await ensurePreloadedCategoriesLoaded(baseUrl)
        profileCategories.value = normalizeCategoriesFromResponse(
          { categories: getAllPreloadedCategories(baseUrl) },
          baseUrl
        )
      } catch {
        // The profile can still render its summary without category metadata.
      }
    }

    watch(
      () => props.baseUrl,
      value => void loadProfileCategories(value),
      { immediate: true }
    )

    const profileCategoryMap = computed(() => {
      const map = new Map<number, DiscourseCategory>()
      profileCategories.value.forEach(category => map.set(category.id, category))
      props.user._summary?.top_categories?.forEach(category => {
        const current = map.get(category.id)
        map.set(category.id, {
          id: category.id,
          name: category.name,
          slug: category.slug,
          color: category.color,
          text_color: current?.text_color || 'FFFFFF',
          topic_count: category.topic_count,
          ...(current || {})
        })
      })
      return map
    })

    const getProfileTopicCategory = (topic: {
      category_id?: number
      category?: Partial<DiscourseCategory> | null
    }) => {
      const inline = topic.category
      const categoryId = Number(topic.category_id ?? inline?.id)
      const existing = Number.isFinite(categoryId) ? profileCategoryMap.value.get(categoryId) : null
      if (!inline || !Number.isFinite(categoryId)) return existing || null
      return {
        ...(existing || {
          id: categoryId,
          name: inline.name || `分类 ${categoryId}`,
          slug: inline.slug || String(categoryId),
          color: inline.color || '64748B',
          text_color: inline.text_color || 'FFFFFF',
          topic_count: 0
        }),
        ...inline,
        id: categoryId,
        name: inline.name || existing?.name || `分类 ${categoryId}`,
        slug: inline.slug || existing?.slug || String(categoryId),
        color: inline.color || existing?.color || '64748B',
        text_color: inline.text_color || existing?.text_color || 'FFFFFF',
        topic_count: existing?.topic_count || 0
      } as DiscourseCategory
    }

    const toggleFollow = async () => {
      if (followSaving.value) return
      const next = !isFollowed.value
      followSaving.value = true
      try {
        await setUserFollowed(props.baseUrl, props.user.username, next)
        props.user.is_followed = next
        props.user.total_followers = Math.max(
          0,
          Number(props.user.total_followers || 0) + (next ? 1 : -1)
        )
        message.success(next ? '已关注' : '已取消关注')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '关注操作失败')
      } finally {
        followSaving.value = false
      }
    }

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
        <header
          class="user-profile-header"
          style={{
            backgroundImage: profileBackground.value
              ? `url("${profileBackground.value.replace(/"/g, '%22')}")`
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
                data-user-card={props.user.username}
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
                  {Number(props.user.total_following) > 0 && (
                    <button
                      type="button"
                      class="user-profile-header__follow-count"
                      onClick={() => emit('openFollowing', props.user.username)}
                    >
                      关注 {props.user.total_following}
                    </button>
                  )}
                  {Number(props.user.total_followers) > 0 && (
                    <button
                      type="button"
                      class="user-profile-header__follow-count"
                      onClick={() => emit('openFollowers', props.user.username)}
                    >
                      粉丝 {props.user.total_followers}
                    </button>
                  )}
                </div>

                <div class="user-profile-header__hint">用户概览</div>
              </div>

              {!props.showSettings && (
                <div class="user-profile-header__actions">
                  {canMessage.value && (
                    <button
                      type="button"
                      onClick={() => emit('composeMessage', props.user.username)}
                    >
                      私信
                    </button>
                  )}
                  {canChat.value && (
                    <button type="button" onClick={() => emit('startChat', props.user.username)}>
                      聊天
                    </button>
                  )}
                  {canFollow.value && (
                    <button
                      type="button"
                      class={isFollowed.value ? 'is-following' : ''}
                      disabled={followSaving.value}
                      onClick={() => void toggleFollow()}
                    >
                      {followSaving.value ? '处理中…' : isFollowed.value ? '已关注' : '关注'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <UserTabs
          active="summary"
          showSettings={props.showSettings}
          showGroups={props.showGroups}
          onSwitchTab={tab => emit('switchMainTab', tab)}
        />

        {props.user.bio_cooked && (
          <section class="user-profile-card user-profile-card--bio">
            <h3 class="user-profile-card__title">个人简介</h3>
            <div
              class="user-bio-content"
              innerHTML={sanitizeDiscourseHtml(props.user.bio_cooked)}
            />
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
            {props.user._summary.solved_count !== undefined && (
              <div class="user-profile-stat-card">
                <div class="user-profile-stat-card__value is-emerald">
                  {props.user._summary.solved_count || 0}
                </div>
                <div class="user-profile-stat-card__label">已解决</div>
              </div>
            )}
          </section>
        )}

        {props.user.featured_topic && (
          <section class="user-profile-card">
            <h3 class="user-profile-card__title">置顶话题</h3>
            <button
              type="button"
              class="user-profile-featured-topic"
              data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(props.user.featured_topic.slug)}/${props.user.featured_topic.id}`}
              onClick={() => emit('openTopic', props.user.featured_topic)}
            >
              <span
                innerHTML={sanitizeDiscourseHtml(
                  props.user.featured_topic.fancy_title || props.user.featured_topic.title
                )}
              />
              <span class="user-profile-featured-topic__meta">
                ({props.user.featured_topic.posts_count} 帖子)
              </span>
            </button>
          </section>
        )}

        <div class="user-profile-summary-columns" aria-label="用户概览详情">
          {props.user._summary?.top_categories && props.user._summary.top_categories.length > 0 && (
            <section class="user-profile-card">
              <h3 class="user-profile-card__title">活跃分类</h3>
              <div class="user-profile-category-list">
                {props.user._summary.top_categories.slice(0, 5).map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    class="user-profile-category-row"
                    data-discourse-url={`${props.baseUrl}/c/${cat.slug}/${cat.id}`}
                    onClick={() => emit('openCategory', cat)}
                  >
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
                  </button>
                ))}
              </div>
            </section>
          )}

          {props.user._topics && props.user._topics.length > 0 && (
            <section class="user-profile-card">
              <h3 class="user-profile-card__title">热门话题</h3>
              <div class="user-profile-topic-list">
                {props.user._topics.slice(0, 6).map(topic => (
                  <button
                    key={topic.id}
                    type="button"
                    class="user-profile-topic-item"
                    data-discourse-url={`${props.baseUrl}/t/${encodeURIComponent(topic.slug)}/${topic.id}`}
                    onClick={() => emit('openTopic', topic)}
                  >
                    <div
                      class="user-profile-topic-item__title"
                      innerHTML={sanitizeDiscourseHtml(topic.fancy_title || topic.title)}
                    />
                    {(() => {
                      const category = getProfileTopicCategory(topic)
                      return category ? (
                        <div class="user-profile-topic-item__category">
                          <TopicCategoryBadge
                            category={category}
                            baseUrl={props.baseUrl}
                            clickable
                            onClick={(value: DiscourseCategory) => emit('openCategory', value)}
                          />
                          <span
                            class="user-profile-topic-item__category-divider"
                            aria-hidden="true"
                          />
                        </div>
                      ) : null
                    })()}
                    <div class="user-profile-topic-item__meta">
                      {topic.posts_count} 帖子 · {topic.like_count} 赞
                    </div>
                  </button>
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

        {props.user._badges && props.user._badges.length > 0 && (
          <section class="user-profile-card">
            <div class="user-profile-card__title-row">
              <h3 class="user-profile-card__title">徽章</h3>
              <button
                type="button"
                class="user-profile-card__more-btn"
                onClick={() => emit('openBadges', props.user.username)}
              >
                查看全部
              </button>
            </div>
            <div class="user-profile-badge-grid">
              {props.user._badges.slice(0, 8).map(badge => (
                <div
                  key={badge.id}
                  class="user-profile-badge-item"
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
                      class="user-profile-badge-item__image"
                    />
                  ) : badge.icon ? (
                    <svg class="user-profile-badge-item__icon" aria-hidden="true">
                      <use href={getDiscourseIconHref(badge.icon)} />
                    </svg>
                  ) : (
                    <div class="user-profile-badge-item__placeholder" />
                  )}
                  <div class="user-profile-badge-item__name">{badge.name}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }
})
