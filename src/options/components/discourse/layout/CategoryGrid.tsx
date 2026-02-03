import { defineComponent, computed } from 'vue'

import type { DiscourseCategory, DiscourseTopic } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import '../css/CategoryGrid.css'

type CategoryTopic = NonNullable<DiscourseCategory['topics']>[number]

export default defineComponent({
  name: 'CategoryGrid',
  props: {
    categories: { type: Array as () => DiscourseCategory[], required: true },
    title: { type: String, default: '分类' },
    baseUrl: { type: String, default: '' },
    layout: { type: String as () => 'grid' | 'directory', default: 'grid' }
  },
  emits: ['click', 'topicClick'],
  setup(props, { emit }) {
    const hasHierarchy = computed(() => {
      const hasChildren = props.categories.some(
        cat => cat.parent_category_id || (cat.subcategory_ids?.length || 0) > 0
      )
      const hasParents = props.categories.some(cat => !cat.parent_category_id)
      return hasChildren && hasParents
    })

    const topCategories = computed(() =>
      hasHierarchy.value
        ? props.categories.filter(cat => !cat.parent_category_id)
        : props.categories
    )

    const childrenByParent = computed(() => {
      const map = new Map<number, DiscourseCategory[]>()
      const byId = new Map<number, DiscourseCategory>()
      props.categories.forEach(cat => {
        byId.set(cat.id, cat)
      })

      const pushChild = (parentId: number, child: DiscourseCategory) => {
        const list = map.get(parentId) || []
        if (!list.some(item => item.id === child.id)) {
          list.push(child)
          map.set(parentId, list)
        }
      }

      props.categories.forEach(cat => {
        if (cat.parent_category_id) {
          pushChild(cat.parent_category_id, cat)
        }
      })

      props.categories.forEach(cat => {
        if (!cat.subcategory_ids?.length) return
        cat.subcategory_ids.forEach(id => {
          const child = byId.get(id)
          if (child) {
            pushChild(cat.id, child)
          }
        })
      })

      return map
    })

    const getImageUrl = (url?: string | null) => {
      if (!url) return ''
      return url.startsWith('http') ? url : `${props.baseUrl}${url}`
    }

    const getIconHref = (icon?: string | null) => {
      if (!icon) return ''
      return `#${icon}`
    }

    const getTopicTitle = (topic: CategoryTopic) => {
      return topic.fancy_title || topic.title
    }

    return () => {
      if (props.categories.length === 0) return null

      return (
        <div>
          <h3 class="text-lg font-semibold mb-3 dark:text-white">{props.title}</h3>
          {props.layout === 'directory' ? (
            <div class="category-directory">
              {topCategories.value.map(cat => (
                <div
                  key={cat.id}
                  class="category-directory-row"
                  style={{ borderLeftColor: `#${cat.color}` }}
                >
                  <div class="category-directory-left" onClick={() => emit('click', cat)}>
                    <div class="category-directory-title-wrap">
                      <div
                        class="category-icon-wrap category-icon-wrap-lg"
                        style={{ color: `#${cat.color}` }}
                      >
                        {cat.uploaded_logo?.url ? (
                          <img
                            src={getImageUrl(cat.uploaded_logo.url)}
                            alt={cat.name}
                            class="category-icon-img category-icon-img-lg"
                          />
                        ) : cat.uploaded_logo_dark?.url ? (
                          <img
                            src={getImageUrl(cat.uploaded_logo_dark.url)}
                            alt={cat.name}
                            class="category-icon-img category-icon-img-lg"
                          />
                        ) : cat.emoji ? (
                          <span class="category-emoji">{cat.emoji}</span>
                        ) : cat.icon ? (
                          <svg class="category-icon-svg" viewBox="0 0 24 24">
                            <use href={getIconHref(cat.icon)} />
                          </svg>
                        ) : (
                          <span
                            class="category-icon-dot category-icon-dot-lg"
                            style={{ backgroundColor: `#${cat.color}` }}
                          />
                        )}
                      </div>
                      <div>
                        <div class="font-semibold dark:text-white">{cat.name}</div>
                        <div class="text-xs text-gray-500">{cat.topic_count} 话题</div>
                      </div>
                    </div>
                    <div class="text-xs text-gray-500 mt-2 line-clamp-2">
                      {cat.description_excerpt || cat.description || ''}
                    </div>
                    {hasHierarchy.value &&
                      (childrenByParent.value.get(cat.id)?.length || 0) > 0 && (
                        <div class="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                          {childrenByParent.value
                            .get(cat.id)
                            ?.slice(0, 8)
                            .map(child => (
                              <button
                                key={child.id}
                                class="subcategory-chip"
                                onClick={(e: Event) => {
                                  e.stopPropagation()
                                  emit('click', child)
                                }}
                              >
                                {child.name}
                              </button>
                            ))}
                        </div>
                      )}
                  </div>

                  <div class="category-directory-right">
                    {(cat.topics || []).slice(0, 10).map(topic => (
                      <div
                        key={topic.id}
                        class="category-topic-row"
                        onClick={() => emit('topicClick', topic as DiscourseTopic)}
                      >
                        <span class="category-topic-title" title={getTopicTitle(topic)}>
                          {getTopicTitle(topic)}
                        </span>
                        <span class="category-topic-meta">
                          {topic.last_poster?.avatar_template && (
                            <img
                              src={getAvatarUrl(
                                topic.last_poster.avatar_template,
                                props.baseUrl || '',
                                24
                              )}
                              class="category-topic-avatar"
                              alt={topic.last_poster?.username || ''}
                            />
                          )}
                          {topic.last_poster?.username && (
                            <span class="truncate max-w-[100px]">{topic.last_poster.username}</span>
                          )}
                          {topic.last_posted_at && <span>{formatTime(topic.last_posted_at)}</span>}
                          <span>{topic.reply_count ?? 0}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {topCategories.value.map(cat => (
                <div
                  key={cat.id}
                  class="p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
                  style={{ borderLeftColor: `#${cat.color}`, borderLeftWidth: '4px' }}
                  onClick={() => emit('click', cat)}
                >
                  <div class="flex items-center gap-2">
                    <div class="category-icon-wrap" style={{ color: `#${cat.color}` }}>
                      {cat.uploaded_logo?.url ? (
                        <img
                          src={getImageUrl(cat.uploaded_logo.url)}
                          alt={cat.name}
                          class="category-icon-img"
                        />
                      ) : cat.uploaded_logo_dark?.url ? (
                        <img
                          src={getImageUrl(cat.uploaded_logo_dark.url)}
                          alt={cat.name}
                          class="category-icon-img"
                        />
                      ) : cat.emoji ? (
                        <span class="category-emoji">{cat.emoji}</span>
                      ) : cat.icon ? (
                        <svg class="category-icon-svg" viewBox="0 0 24 24">
                          <use href={getIconHref(cat.icon)} />
                        </svg>
                      ) : (
                        <span
                          class="category-icon-dot"
                          style={{ backgroundColor: `#${cat.color}` }}
                        />
                      )}
                    </div>
                    <div class="font-medium dark:text-white">{cat.name}</div>
                  </div>
                  <div class="text-xs text-gray-500">{cat.topic_count} 话题</div>
                  {hasHierarchy.value && (childrenByParent.value.get(cat.id)?.length || 0) > 0 && (
                    <div class="mt-2 space-y-1">
                      {childrenByParent.value
                        .get(cat.id)
                        ?.slice(0, 4)
                        .map(child => (
                          <div
                            key={child.id}
                            class="text-xs text-gray-600 dark:text-gray-300 truncate cursor-pointer hover:text-blue-600"
                            onClick={(e: Event) => {
                              e.stopPropagation()
                              emit('click', child)
                            }}
                          >
                            <span class="inline-flex items-center gap-1">
                              <span class="subcategory-icon" style={{ color: `#${child.color}` }}>
                                {child.uploaded_logo?.url ? (
                                  <img
                                    src={getImageUrl(child.uploaded_logo.url)}
                                    alt={child.name}
                                    class="subcategory-icon-img"
                                  />
                                ) : child.uploaded_logo_dark?.url ? (
                                  <img
                                    src={getImageUrl(child.uploaded_logo_dark.url)}
                                    alt={child.name}
                                    class="subcategory-icon-img"
                                  />
                                ) : child.emoji ? (
                                  <span class="subcategory-emoji">{child.emoji}</span>
                                ) : child.icon ? (
                                  <svg class="subcategory-icon-svg" viewBox="0 0 24 24">
                                    <use href={getIconHref(child.icon)} />
                                  </svg>
                                ) : (
                                  <span
                                    class="subcategory-dot"
                                    style={{ backgroundColor: `#${child.color}` }}
                                  />
                                )}
                              </span>
                              {child.name}
                            </span>
                          </div>
                        ))}
                      {(childrenByParent.value.get(cat.id)?.length || 0) > 4 && (
                        <div class="text-xs text-gray-400">
                          还有 {(childrenByParent.value.get(cat.id)?.length || 0) - 4} 个子分类...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
  }
})
