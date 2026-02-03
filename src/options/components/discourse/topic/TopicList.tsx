import { defineComponent } from 'vue'

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
    users: { type: Array as () => DiscourseUser[], default: undefined }
  },
  emits: ['click', 'middleClick', 'openUser', 'openTag'],
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
      // 返回所有发帖人，包括原始发帖人、频繁发帖人和最新发帖人
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

    return () => (
      <div class="space-y-2">
        {props.topics.map(topic => (
          <div
            key={topic.id}
            class="topic-item p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => handleClick(topic)}
            onAuxclick={(e: MouseEvent) => {
              if (e.button === 1) handleMiddleClick(topic, props.baseUrl)
            }}
          >
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                {/* 分区和标签 */}
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  {getCategory(topic, props.categories) && (
                    <span
                      class="topic-category text-xs px-2 py-0.5 rounded-full"
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
                        description={typeof tag === 'string' ? null : tag.description || null}
                        compact
                        clickable
                      />
                    </span>
                  ))}
                </div>

                {/* 标题 */}
                <div
                  class="font-medium dark:text-white truncate"
                  innerHTML={topic.fancy_title || topic.title}
                />

                {/* 统计信息 */}
                <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span>{topic.posts_count} 回复</span>
                  <span>{topic.views} 浏览</span>
                  <span>{topic.like_count} 赞</span>
                  <span>{formatTime(topic.last_posted_at || topic.created_at)}</span>
                  {getUnreadCount(topic) > 0 && (
                    <span class="topic-unread">未读 +{getUnreadCount(topic)}</span>
                  )}
                </div>

                {/* 活跃发言人 */}
                {getPosters(topic, props.users).length > 0 && (
                  <div class="flex items-center gap-1 mt-2">
                    <span class="text-xs text-gray-400 mr-1">活跃：</span>
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
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
})
