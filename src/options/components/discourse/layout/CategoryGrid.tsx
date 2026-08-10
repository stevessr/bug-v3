import { defineComponent, computed } from 'vue'

import { resolveDiscourseHttpUrl } from '../navigation'
import type { DiscourseCategory, DiscourseTopic } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import { getDiscourseIconHref } from './iconSprite'
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
      return resolveDiscourseHttpUrl(url, props.baseUrl) || ''
    }

    const getTopicTitle = (topic: CategoryTopic) => {
      return topic.fancy_title || topic.title
    }

    const getCategoryUrl = (category: DiscourseCategory) =>
      `${props.baseUrl}/c/${encodeURIComponent(category.slug)}/${category.id}`

    const getTopicUrl = (topic: CategoryTopic) =>
      `${props.baseUrl}/t/${encodeURIComponent(topic.slug || String(topic.id))}/${topic.id}`

    return () => {
      if (props.categories.length === 0) return null

      return (
        <section class="category-grid" aria-label={props.title || '分类'}>
          {props.title && <h3 class="category-grid__title">{props.title}</h3>}
          {props.layout === 'directory' ? (
            <div class="category-directory">
              {topCategories.value.map(cat => (
                <div
                  key={cat.id}
                  class="category-directory-row"
                  style={{ borderLeftColor: `#${cat.color}` }}
                >
                  <div class="category-directory-left">
                    <button
                      type="button"
                      class="category-directory-primary"
                      data-discourse-url={getCategoryUrl(cat)}
                      onClick={() => emit('click', cat)}
                    >
                      <span class="category-directory-title-wrap">
                        <span
                          class="category-icon-wrap category-icon-wrap-lg"
                          style={{ color: `#${cat.color}` }}
                        >
                          {cat.uploaded_logo?.url ? (
                            <img
                              src={getImageUrl(cat.uploaded_logo.url)}
                              alt=""
                              class="category-icon-img category-icon-img-lg"
                            />
                          ) : cat.uploaded_logo_dark?.url ? (
                            <img
                              src={getImageUrl(cat.uploaded_logo_dark.url)}
                              alt=""
                              class="category-icon-img category-icon-img-lg"
                            />
                          ) : cat.emoji ? (
                            <span class="category-emoji" aria-hidden="true">
                              {cat.emoji}
                            </span>
                          ) : cat.icon ? (
                            <svg class="category-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                              <use href={getDiscourseIconHref(cat.icon)} />
                            </svg>
                          ) : (
                            <span
                              class="category-icon-dot category-icon-dot-lg"
                              style={{ backgroundColor: `#${cat.color}` }}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span class="category-directory-heading">
                          <span class="category-directory-name">{cat.name}</span>
                          <span class="category-directory-count">{cat.topic_count} 话题</span>
                        </span>
                      </span>
                      <span class="category-directory-description">
                        {cat.description_excerpt || cat.description || ''}
                      </span>
                    </button>
                    {hasHierarchy.value &&
                      (childrenByParent.value.get(cat.id)?.length || 0) > 0 && (
                        <div class="subcategory-list" aria-label={`${cat.name} 的子分类`}>
                          {childrenByParent.value
                            .get(cat.id)
                            ?.slice(0, 8)
                            .map(child => (
                              <button
                                key={child.id}
                                type="button"
                                class="subcategory-chip"
                                data-discourse-url={getCategoryUrl(child)}
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
                      <button
                        key={topic.id}
                        type="button"
                        class="category-topic-row"
                        data-discourse-url={getTopicUrl(topic)}
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
                            <span class="category-topic-username">
                              {topic.last_poster.username}
                            </span>
                          )}
                          {topic.last_posted_at && <span>{formatTime(topic.last_posted_at)}</span>}
                          <span aria-label={`${topic.reply_count ?? 0} 条回复`}>
                            {topic.reply_count ?? 0}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class="category-card-grid">
              {topCategories.value.map(cat => (
                <article
                  key={cat.id}
                  class="category-card"
                  style={{ borderLeftColor: `#${cat.color}`, borderLeftWidth: '4px' }}
                >
                  <button
                    type="button"
                    class="category-card__primary"
                    data-discourse-url={getCategoryUrl(cat)}
                    onClick={() => emit('click', cat)}
                  >
                    <span class="category-card__heading">
                      <span class="category-icon-wrap" style={{ color: `#${cat.color}` }}>
                        {cat.uploaded_logo?.url ? (
                          <img
                            src={getImageUrl(cat.uploaded_logo.url)}
                            alt=""
                            class="category-icon-img"
                          />
                        ) : cat.uploaded_logo_dark?.url ? (
                          <img
                            src={getImageUrl(cat.uploaded_logo_dark.url)}
                            alt=""
                            class="category-icon-img"
                          />
                        ) : cat.emoji ? (
                          <span class="category-emoji" aria-hidden="true">
                            {cat.emoji}
                          </span>
                        ) : cat.icon ? (
                          <svg class="category-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                            <use href={getDiscourseIconHref(cat.icon)} />
                          </svg>
                        ) : (
                          <span
                            class="category-icon-dot"
                            style={{ backgroundColor: `#${cat.color}` }}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span class="category-card__name">{cat.name}</span>
                    </span>
                    <span class="category-card__count">{cat.topic_count} 话题</span>
                  </button>
                  {hasHierarchy.value && (childrenByParent.value.get(cat.id)?.length || 0) > 0 && (
                    <div class="category-card__children" aria-label={`${cat.name} 的子分类`}>
                      {childrenByParent.value
                        .get(cat.id)
                        ?.slice(0, 4)
                        .map(child => (
                          <button
                            key={child.id}
                            type="button"
                            class="category-card__child"
                            data-discourse-url={getCategoryUrl(child)}
                            onClick={(e: Event) => {
                              e.stopPropagation()
                              emit('click', child)
                            }}
                          >
                            <span class="category-card__child-content">
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
                                    <use href={getDiscourseIconHref(child.icon)} />
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
                          </button>
                        ))}
                      {(childrenByParent.value.get(cat.id)?.length || 0) > 4 && (
                        <div class="category-card__more">
                          还有 {(childrenByParent.value.get(cat.id)?.length || 0) - 4} 个子分类...
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )
    }
  }
})
