import { defineComponent, type PropType } from 'vue'

import type {
  DiscourseTopic,
  SuggestedTopic,
  DiscourseCategory,
  DiscourseUser,
  DiscourseTopicTag
} from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import TagPill from '../layout/TagPill'
import '../css/TopicList.css'

export default defineComponent({
  name: 'TopicList',
  props: {
    topics: { type: Array as () => (DiscourseTopic | SuggestedTopic)[], required: true },
    baseUrl: { type: String, required: true },
    categories: { type: Array as () => DiscourseCategory[], default: undefined },
    users: { type: Array as () => DiscourseUser[], default: undefined },
    showHeader: { type: Boolean, default: true },
    sortKey: {
      type: String as PropType<'replies' | 'views' | 'activity' | null>,
      default: null
    },
    sortOrder: {
      type: String as PropType<'asc' | 'desc'>,
      default: 'desc'
    }
  },
  emits: ['click', 'middleClick', 'openUser', 'openTag', 'sort'],
  setup(props, { emit }) {
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

    const getCategory = (
      topic: DiscourseTopic | SuggestedTopic,
      categories?: DiscourseCategory[]
    ) => {
      const categoryId = (topic as DiscourseTopic).category_id
      if (!categoryId || !categories) return null
      return categories.find(c => c.id === categoryId)
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

    return () => (
      <div class="topic-list">
        {props.showHeader && (
          <div class="topic-list-header">
            <div class="topic-list-header-main">主题</div>
            <div class="topic-list-header-stats">
              <button
                class={['topic-sort-btn', props.sortKey === 'replies' ? 'active' : '']}
                onClick={() => handleSortClick('replies')}
              >
                回复 {getSortIndicator('replies')}
              </button>
              <button
                class={['topic-sort-btn', props.sortKey === 'views' ? 'active' : '']}
                onClick={() => handleSortClick('views')}
              >
                浏览 {getSortIndicator('views')}
              </button>
              <button
                class={['topic-sort-btn', props.sortKey === 'activity' ? 'active' : '']}
                onClick={() => handleSortClick('activity')}
              >
                活动 {getSortIndicator('activity')}
              </button>
            </div>
          </div>
        )}
        {props.topics.map(topic => (
          <div
            key={topic.id}
            class="topic-row"
            onClick={() => handleClick(topic)}
            onAuxclick={(e: MouseEvent) => {
              if (e.button === 1) handleMiddleClick(topic, props.baseUrl)
            }}
          >
            <div class="topic-main">
              <div class="topic-title-row">
                <div class="topic-title" innerHTML={topic.fancy_title || topic.title} />
                {getUnreadCount(topic) > 0 && (
                  <span class="topic-unread">未读 +{getUnreadCount(topic)}</span>
                )}
              </div>
              <div class="topic-meta">
                {getCategory(topic, props.categories) && (
                  <span
                    class="topic-category"
                    style={{
                      backgroundColor: getCategory(topic, props.categories)!.color + '20',
                      color: getCategory(topic, props.categories)!.text_color
                    }}
                  >
                    {getCategory(topic, props.categories)!.name}
                  </span>
                )}
                {((topic as DiscourseTopic).tags || []).map(tag => (
                  <span
                    key={getTagKey(tag)}
                    class="topic-tag"
                    onClick={(e: Event) => {
                      e.stopPropagation()
                      handleTagClick(tag)
                    }}
                  >
                    <TagPill
                      name={getTagLabel(tag)}
                      text={getTagLabel(tag)}
                      description={
                        typeof tag === 'string' ? undefined : tag.description || undefined
                      }
                      compact
                      clickable
                    />
                  </span>
                ))}
              </div>
            </div>
            <div class="topic-right">
              {getPosters(topic, props.users).length > 0 && (
                <div class="topic-posters">
                  {getPosters(topic, props.users).map(poster => (
                    <div
                      key={poster.user_id}
                      class={['poster-avatar', poster.extras === 'latest' ? 'latest-poster' : '']}
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
              )}
              <div class="topic-numbers">
                <span class="topic-stat">{topic.posts_count}</span>
                <span class="topic-stat">{topic.views}</span>
                <span class="topic-stat topic-stat-time">
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
