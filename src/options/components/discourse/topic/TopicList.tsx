import { computed, defineComponent, ref, watch, type PropType } from 'vue'

import type {
  DiscourseTopic,
  SuggestedTopic,
  DiscourseCategory,
  DiscourseUser,
  DiscourseTopicTag
} from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import TagPill from '../layout/TagPill'
import EmojiTitle from '../layout/EmojiTitle'
import TopicCategoryBadge from '../layout/TopicCategoryBadge'
import { normalizeCategoriesFromResponse } from '../routes/categories'
import { getTopicAuthorUsername, shouldFilterBlockedContent } from '../blocked'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories
} from '../linux.do/preloadedCategories'
import '../css/TopicList.css'

export default defineComponent({
  name: 'TopicList',
  props: {
    topics: { type: Array as () => (DiscourseTopic | SuggestedTopic)[], required: true },
    baseUrl: { type: String, required: true },
    categories: { type: Array as () => DiscourseCategory[], default: () => [] },
    users: { type: Array as () => DiscourseUser[], default: undefined },
    showHeader: { type: Boolean, default: true },
    sortKey: {
      type: String as PropType<'replies' | 'views' | 'activity' | null>,
      default: null
    },
    sortOrder: {
      type: String as PropType<'asc' | 'desc'>,
      default: 'desc'
    },
    blockedUsernames: { type: Array as () => string[], default: () => [] },
    exemptUsername: { type: String as PropType<string | null>, default: null }
  },
  emits: ['click', 'middleClick', 'openUser', 'openTag', 'openCategory', 'sort'],
  setup(props, { emit }) {
    const preloadedCategories = ref<DiscourseCategory[]>([])
    let categoryRequestId = 0

    const loadCategoryMetadata = async (baseUrl: string) => {
      const requestId = ++categoryRequestId
      if (!baseUrl) {
        preloadedCategories.value = []
        return
      }

      try {
        await ensurePreloadedCategoriesLoaded(baseUrl)
        if (requestId !== categoryRequestId) return
        preloadedCategories.value = normalizeCategoriesFromResponse(
          { categories: getAllPreloadedCategories(baseUrl) },
          baseUrl
        )
      } catch {
        // The list can still use the categories supplied by its parent.
      }
    }

    watch(
      () => props.baseUrl,
      value => void loadCategoryMetadata(value),
      { immediate: true }
    )

    const handleClick = (topic: DiscourseTopic | SuggestedTopic) => {
      emit('click', topic)
    }

    const getUnreadCount = (topic: DiscourseTopic | SuggestedTopic) => {
      const unread =
        (topic as DiscourseTopic).unread_posts ??
        (topic as DiscourseTopic).new_posts ??
        (topic as DiscourseTopic).unread ??
        0
      return typeof unread === 'number' ? unread : 0
    }

    const getTargetPostNumber = (topic: DiscourseTopic | SuggestedTopic) => {
      const unread = getUnreadCount(topic)
      const lastRead = (topic as DiscourseTopic).last_read_post_number
      if (unread > 0 && typeof lastRead === 'number' && lastRead >= 0) {
        return lastRead + 1
      }
      return null
    }

    const getTopicUrl = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
      const target = getTargetPostNumber(topic)
      return target
        ? `${baseUrl}/t/${topic.slug}/${topic.id}/${target}`
        : `${baseUrl}/t/${topic.slug}/${topic.id}`
    }

    const handleMiddleClick = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
      emit('middleClick', getTopicUrl(topic, baseUrl))
    }

    const handleRowKeydown = (event: KeyboardEvent, topic: DiscourseTopic | SuggestedTopic) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      handleClick(topic)
    }

    const normalizeInlineCategory = (value: unknown): DiscourseCategory | null => {
      if (!value || typeof value !== 'object') return null
      const raw = value as Record<string, any>
      const id = Number(raw.id ?? raw.category_id)
      const name = typeof raw.name === 'string' ? raw.name.trim() : ''
      if (!Number.isFinite(id) || id <= 0 || !name) return null
      return {
        id,
        name,
        slug: typeof raw.slug === 'string' ? raw.slug : String(id),
        color: typeof raw.color === 'string' ? raw.color : '',
        text_color: typeof raw.text_color === 'string' ? raw.text_color : '',
        topic_count: Number(raw.topic_count) || 0,
        parent_category_id: raw.parent_category_id ?? null,
        subcategory_ids: Array.isArray(raw.subcategory_ids) ? raw.subcategory_ids : null,
        style_type: typeof raw.style_type === 'string' ? raw.style_type : null,
        icon: typeof raw.icon === 'string' ? raw.icon : null,
        emoji: typeof raw.emoji === 'string' ? raw.emoji : null,
        uploaded_logo: raw.uploaded_logo?.url ? { url: String(raw.uploaded_logo.url) } : null,
        uploaded_logo_dark: raw.uploaded_logo_dark?.url
          ? { url: String(raw.uploaded_logo_dark.url) }
          : null
      }
    }

    const mergeCategory = (
      base: DiscourseCategory | null,
      inline: DiscourseCategory | null
    ): DiscourseCategory | null => {
      if (!base) return inline
      if (!inline) return base
      const merged = { ...base }
      ;(Object.keys(inline) as Array<keyof DiscourseCategory>).forEach(key => {
        const value = inline[key]
        if (value !== undefined && value !== null && value !== '') {
          ;(merged as unknown as Record<string, unknown>)[key] = value
        }
      })
      return merged
    }

    // Index categories once per (props, preloaded) change instead of
    // rebuilding the merged source array for every topic row render.
    const categoryIndex = computed(() => {
      const map = new Map<number, DiscourseCategory>()
      for (const category of props.categories) map.set(category.id, category)
      for (const category of preloadedCategories.value) {
        if (!map.has(category.id)) map.set(category.id, category)
      }
      return map
    })

    const getCategory = (topic: DiscourseTopic | SuggestedTopic) => {
      const rawTopic = topic as DiscourseTopic & { category?: unknown }
      const categoryId = Number(rawTopic.category_id)
      const inline = normalizeInlineCategory(rawTopic.category)
      const fromId = Number.isFinite(categoryId)
        ? categoryIndex.value.get(categoryId) || null
        : null
      return mergeCategory(fromId, inline)
    }

    const renderCategory = (cat: DiscourseCategory) => {
      return (
        <TopicCategoryBadge
          category={cat}
          baseUrl={props.baseUrl}
          clickable
          onClick={(category: DiscourseCategory) => emit('openCategory', category)}
        />
      )
    }

    const renderTopicMeta = (topic: DiscourseTopic | SuggestedTopic) => {
      const category = getCategory(topic)
      const tags = (topic as DiscourseTopic).tags || []
      return (
        <div class="topic-meta">
          {category && renderCategory(category)}
          {category && tags.length > 0 && <span class="topic-meta-divider" aria-hidden="true" />}
          {tags.map(tag => (
            <span
              key={getTagKey(tag)}
              class="topic-tag"
              data-discourse-url={`${props.baseUrl}/tag/${encodeURIComponent(getTagLabel(tag))}`}
              onClick={(e: Event) => {
                e.stopPropagation()
                handleTagClick(tag)
              }}
            >
              <TagPill
                name={getTagLabel(tag)}
                text={getTagLabel(tag)}
                description={typeof tag === 'string' ? undefined : tag.description || undefined}
                compact
                clickable
              />
            </span>
          ))}
        </div>
      )
    }

    const getUserById = (userId: number, users?: DiscourseUser[]) => {
      if (!users) return null
      return users.find(u => u.id === userId)
    }

    const getPosters = (topic: DiscourseTopic | SuggestedTopic, users?: DiscourseUser[]) => {
      const posters = (topic as DiscourseTopic).posters || []
      return posters.map(poster => {
        const user = getUserById(poster.user_id, users)
        return {
          ...poster,
          user
        }
      })
    }

    const handleUserClick = (username: string) => {
      emit('openUser', username)
    }

    const getTagLabel = (tag: string | DiscourseTopicTag) => {
      if (typeof tag === 'string') return tag
      return tag.name || tag.text || tag.slug || String(tag.id || '')
    }

    const getTagKey = (tag: string | DiscourseTopicTag) => {
      if (typeof tag === 'string') return tag
      return String(tag.id || tag.slug || tag.name || tag.text || JSON.stringify(tag))
    }

    const handleTagClick = (tag: string | DiscourseTopicTag) => {
      const label = getTagLabel(tag).trim()
      if (!label) return
      emit('openTag', label)
    }

    const handleSortClick = (key: 'replies' | 'views' | 'activity') => {
      emit('sort', key)
    }

    const getSortIndicator = (key: 'replies' | 'views' | 'activity') => {
      if (props.sortKey !== key) return ''
      return props.sortOrder === 'asc' ? '↑' : '↓'
    }

    // 屏蔽：隐藏被忽略用户（作者）发起的话题（作者自己的主页上除外）。
    const visibleTopics = computed(() =>
      props.topics.filter(topic => {
        const authorUsername = getTopicAuthorUsername(
          topic,
          userId => getUserById(userId, props.users)?.username
        )
        return !shouldFilterBlockedContent(
          props.blockedUsernames,
          authorUsername,
          props.exemptUsername
        )
      })
    )

    return () => (
      <div class="topic-list">
        {props.showHeader && (
          <div class="topic-list-header">
            <div class="topic-list-header-main">主题</div>
            <div class="topic-list-header-stats">
              <button
                class={[
                  'topic-sort-btn',
                  'topic-col',
                  'topic-col--replies',
                  props.sortKey === 'replies' ? 'active' : ''
                ]}
                onClick={() => handleSortClick('replies')}
              >
                回复 {getSortIndicator('replies')}
              </button>
              <button
                class={[
                  'topic-sort-btn',
                  'topic-col',
                  'topic-col--views',
                  props.sortKey === 'views' ? 'active' : ''
                ]}
                onClick={() => handleSortClick('views')}
              >
                浏览 {getSortIndicator('views')}
              </button>
              <button
                class={[
                  'topic-sort-btn',
                  'topic-col',
                  'topic-col--activity',
                  props.sortKey === 'activity' ? 'active' : ''
                ]}
                onClick={() => handleSortClick('activity')}
              >
                活动 {getSortIndicator('activity')}
              </button>
            </div>
          </div>
        )}
        {visibleTopics.value.map(topic => (
          <div
            key={topic.id}
            class="topic-row"
            role="link"
            tabindex={0}
            data-discourse-url={getTopicUrl(topic, props.baseUrl)}
            aria-label={`打开话题：${topic.title}`}
            onClick={() => handleClick(topic)}
            onKeydown={(event: KeyboardEvent) => handleRowKeydown(event, topic)}
            onAuxclick={(e: MouseEvent) => {
              if (e.button === 1) handleMiddleClick(topic, props.baseUrl)
            }}
          >
            <div class="topic-main">
              <div class="topic-title-row">
                <div class="topic-title">
                  <EmojiTitle
                    text={topic.fancy_title || topic.title}
                    baseUrl={props.baseUrl}
                    html={Boolean(topic.fancy_title)}
                  />
                </div>
                {getUnreadCount(topic) > 0 && (
                  <span class="topic-unread">未读 +{getUnreadCount(topic)}</span>
                )}
              </div>
              {renderTopicMeta(topic)}
            </div>
            <div class="topic-right">
              {(() => {
                const posters = getPosters(topic, props.users)
                if (posters.length === 0) return null
                return (
                  <div class="topic-posters">
                    {posters.map(poster => (
                      <div
                        key={poster.user_id}
                        class={['poster-avatar', poster.extras === 'latest' ? 'latest-poster' : '']}
                        data-discourse-url={
                          poster.user
                            ? `${props.baseUrl}/u/${encodeURIComponent(poster.user.username)}`
                            : undefined
                        }
                        data-user-card={poster.user?.username}
                        title={
                          poster.user
                            ? `${poster.user.name || poster.user.username} - ${poster.description}`
                            : poster.description
                        }
                        onClick={(e: Event) => {
                          if (poster.user) {
                            e.stopPropagation()
                            handleUserClick(poster.user.username)
                          }
                        }}
                      >
                        {poster.user && (
                          <img
                            src={getAvatarUrl(poster.user.avatar_template, props.baseUrl, 24)}
                            alt={poster.user.username}
                            class="avatar"
                            loading="lazy"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
              <div class="topic-numbers">
                <span class="topic-stat topic-col topic-col--replies">{topic.posts_count}</span>
                <span class="topic-stat topic-col topic-col--views">{topic.views}</span>
                <span class="topic-stat topic-col topic-col--activity topic-stat-time">
                  {formatTime(topic.last_posted_at || topic.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
})
