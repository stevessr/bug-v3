import { defineComponent, ref, computed, watch, onBeforeUnmount } from 'vue'
import { Button, Input, Select, Switch } from 'ant-design-vue'

import type {
  SearchState,
  DiscourseSearchFilters,
  DiscourseSearchPost,
  DiscourseSearchTopic,
  DiscourseCategory
} from '../types'
import { searchTags } from '../actions'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import { formatTime } from '../utils'
import TagPill from '../layout/TagPill'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'
import '../css/SearchView.css'

export default defineComponent({
  name: 'SearchView',
  props: {
    state: { type: Object as () => SearchState, required: true },
    baseUrl: { type: String, required: true },
    categories: { type: Array as () => DiscourseCategory[], default: () => [] },
    currentCategory: { type: Object as () => DiscourseCategory | null, default: null }
  },
  emits: ['search', 'loadMore', 'open'],
  setup(props, { emit }) {
    const localQuery = ref(props.state.query)
    const localFilters = ref<DiscourseSearchFilters>({ ...props.state.filters })
    const selectedTags = ref<string[]>([])
    const tagOptions = ref<Array<{ value: string; label: string; description?: string | null }>>([])
    const tagsLoading = ref(false)
    const showAdvanced = ref(false)
    let tagSearchTimer: number | null = null
    const preloadedCategoriesReadyToken = ref(0)

    const normalizeTagList = (value: string) => {
      return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    }

    const syncTagsFromFilters = (filters: DiscourseSearchFilters) => {
      selectedTags.value = normalizeTagList(filters.tags)
    }

    syncTagsFromFilters(localFilters.value)

    watch(
      () => props.state.query,
      value => {
        if (value !== localQuery.value) {
          localQuery.value = value
        }
      }
    )

    watch(
      () => props.state.filters,
      value => {
        localFilters.value = { ...value }
        syncTagsFromFilters(value)
      }
    )

    watch(
      () => props.baseUrl,
      async value => {
        if (!isLinuxDoUrl(value)) return
        await ensurePreloadedCategoriesLoaded()
        preloadedCategoriesReadyToken.value++
      },
      { immediate: true }
    )

    const mergedCategories = computed(() => {
      const readyToken = preloadedCategoriesReadyToken.value
      const localMap = new Map<number, DiscourseCategory>()
      const usingLinuxDo = isLinuxDoUrl(props.baseUrl) && readyToken >= 0

      if (usingLinuxDo) {
        getAllPreloadedCategories().forEach(raw => {
          if (typeof raw.id !== 'number') return
          localMap.set(raw.id, {
            id: raw.id,
            name: raw.name || `category-${raw.id}`,
            slug: raw.slug || String(raw.id),
            color: raw.color || '0088CC',
            text_color: raw.text_color || 'FFFFFF',
            topic_count: 0,
            parent_category_id: raw.parent_category_id ?? null,
            style_type: raw.style_type ?? null,
            icon: raw.icon ?? null,
            emoji: raw.emoji ?? null,
            uploaded_logo: raw.uploaded_logo ?? null,
            uploaded_logo_dark: raw.uploaded_logo_dark ?? null
          })
        })
      }

      ;(props.categories || []).forEach(cat => {
        localMap.set(cat.id, { ...localMap.get(cat.id), ...cat })
      })

      if (props.currentCategory?.id) {
        localMap.set(props.currentCategory.id, {
          ...localMap.get(props.currentCategory.id),
          ...props.currentCategory
        })
      }

      return Array.from(localMap.values())
    })

    const categoryOptions = computed(() => {
      return mergedCategories.value.map(cat => {
        const slug = cat.slug || String(cat.id)
        const label = cat.name
          ? cat.slug && cat.slug !== cat.name
            ? `${cat.name} (${cat.slug})`
            : cat.name
          : slug
        return {
          value: slug,
          label,
          id: cat.id
        }
      })
    })

    const filterCategoryOption = (input: string, option?: any) => {
      const keyword = input.trim().toLowerCase()
      if (!keyword) return true
      const label = String(option?.label || '').toLowerCase()
      const value = String(option?.value || '').toLowerCase()
      const id = option?.id != null ? String(option.id) : ''
      return label.includes(keyword) || value.includes(keyword) || id.includes(keyword)
    }

    const categoryIdForTagSearch = computed(() => {
      const raw = localFilters.value.category?.trim()
      if (!raw) return null
      const numeric = Number(raw)
      if (!Number.isNaN(numeric) && String(numeric) === raw) return numeric
      const keyword = raw.toLowerCase()
      const match = mergedCategories.value.find(cat => {
        const slug = cat.slug?.toLowerCase()
        const name = cat.name?.toLowerCase()
        return slug === keyword || name === keyword
      })
      return match?.id ?? null
    })

    const updateSelectedTags = (value: string[]) => {
      const normalized = value.map(item => item.trim()).filter(Boolean)
      selectedTags.value = normalized
      localFilters.value.tags = normalized.join(',')
    }

    const getTagOption = (value: string) => {
      return tagOptions.value.find(option => option.value === value) || null
    }

    const runTagSearch = async (query: string) => {
      const trimmed = query.trim()
      tagsLoading.value = true
      try {
        const results = await searchTags(props.baseUrl, trimmed, categoryIdForTagSearch.value)
        tagOptions.value = results
          .map(item => ({
            value: item.name || item.text || '',
            label: item.text || item.name || '',
            description: item.description || null
          }))
          .filter(option => option.value)
      } catch {
        tagOptions.value = []
      } finally {
        tagsLoading.value = false
      }
    }

    const handleTagSearch = (query: string) => {
      if (tagSearchTimer) window.clearTimeout(tagSearchTimer)
      tagSearchTimer = window.setTimeout(() => runTagSearch(query), 250)
    }

    const handleTagDropdown = (open: boolean) => {
      if (open && tagOptions.value.length === 0) {
        runTagSearch('')
      }
    }

    onBeforeUnmount(() => {
      if (tagSearchTimer) window.clearTimeout(tagSearchTimer)
    })

    watch(
      () => localFilters.value.category,
      () => {
        tagOptions.value = []
        if (selectedTags.value.length === 0) {
          runTagSearch('')
        }
      }
    )

    const topicMap = computed(() => {
      const map = new Map<number, DiscourseSearchTopic>()
      props.state.topics.forEach(topic => map.set(topic.id, topic))
      return map
    })

    const handleSearch = () => {
      emit('search', localQuery.value.trim(), { ...localFilters.value })
    }

    const buildPath = (post: DiscourseSearchPost) => {
      const topic = topicMap.value.get(post.topic_id)
      const slug = post.topic_slug || topic?.slug || 'topic'
      if (post.topic_id && post.post_number) {
        return `/t/${slug}/${post.topic_id}/${post.post_number}`
      }
      if (post.topic_id) {
        return `/t/${slug}/${post.topic_id}`
      }
      return ''
    }

    const openResult = (path: string) => {
      if (path) emit('open', path)
    }

    const handleResultKeydown = (event: KeyboardEvent, path: string) => {
      if (event.key !== 'Enter' || !path) return
      event.preventDefault()
      openResult(path)
    }

    return () => (
      <div class="search-view">
        <header class="search-view__heading">
          <div>
            <span class="search-view__eyebrow">全站检索</span>
            <h2 class="search-view__title">搜索论坛</h2>
            <p class="search-view__description">组合分类、标签与高级条件，精确定位讨论。</p>
          </div>
          {props.state.posts.length > 0 && (
            <span class="search-view__result-count">{props.state.posts.length} 条结果</span>
          )}
        </header>

        <section class="search-panel" aria-label="搜索条件">
          <form
            class="search-query"
            role="search"
            onSubmit={(event: Event) => {
              event.preventDefault()
              handleSearch()
            }}
          >
            <Input
              id="discourse-search-query"
              class="search-query__input"
              value={localQuery.value}
              placeholder="搜索话题、回复、用户..."
              aria-label="搜索关键词"
              onUpdate:value={(value: string) => {
                localQuery.value = value
              }}
            />
            <Button
              type="primary"
              htmlType="submit"
              class="search-query__button"
              loading={props.state.loading}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.5 3a6.5 6.5 0 1 0 3.99 11.63L19.86 21 21 19.86l-6.37-6.37A6.5 6.5 0 0 0 9.5 3Zm0 1.8a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Z" />
              </svg>
              搜索
            </Button>
          </form>

          {/* Basic filters row */}
          <div class="search-filter-grid search-filter-grid--basic">
            <div class="search-field">
              <span class="search-field__label">排序</span>
              <Select
                value={localFilters.value.order}
                class="search-field__control"
                aria-label="结果排序"
                options={[
                  { value: '', label: '默认' },
                  { value: 'latest', label: '最新回复' },
                  { value: 'created', label: '创建时间' },
                  { value: 'activity', label: '最近活动' },
                  { value: 'likes', label: '点赞数' },
                  { value: 'views', label: '浏览量' },
                  { value: 'hot', label: '热门' }
                ]}
                onChange={(value: any) => {
                  localFilters.value.order = value
                }}
              />
            </div>
            <div class="search-field">
              <span class="search-field__label">发帖人</span>
              <Input
                value={localFilters.value.postedBy}
                placeholder="用户名"
                class="search-field__control"
                aria-label="按发帖人筛选"
                onUpdate:value={(value: string) => {
                  localFilters.value.postedBy = value
                }}
              />
            </div>
            <div class="search-field">
              <span class="search-field__label">状态</span>
              <Select
                value={localFilters.value.status}
                class="search-field__control"
                aria-label="按话题状态筛选"
                options={[
                  { value: '', label: '不限' },
                  { value: 'open', label: '开放' },
                  { value: 'closed', label: '已关闭' },
                  { value: 'archived', label: '已归档' },
                  { value: 'listed', label: '可见' },
                  { value: 'unlisted', label: '隐藏' },
                  { value: 'noreplies', label: '无回复' },
                  { value: 'single_user', label: '单用户' }
                ]}
                onChange={(value: any) => {
                  localFilters.value.status = value
                }}
              />
            </div>
            <div class="search-field">
              <span class="search-field__label">分类</span>
              <Select
                mode="SECRET_COMBOBOX_MODE_DO_NOT_USE"
                showSearch
                allowClear
                class="search-field__control"
                aria-label="按分类筛选"
                value={localFilters.value.category || undefined}
                placeholder="选择分类"
                options={categoryOptions.value}
                filterOption={filterCategoryOption}
                onUpdate:value={(value: any) => {
                  localFilters.value.category = value ? String(value).trim() : ''
                }}
              />
            </div>
          </div>

          {/* Tags row */}
          <div class="search-field search-field--tags">
            <span class="search-field__label">标签</span>
            <Select
              class="search-field__control"
              mode="tags"
              showSearch
              aria-label="按标签筛选"
              value={selectedTags.value}
              filterOption={false}
              notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
              placeholder="搜索或输入标签"
              tokenSeparators={[',', ' ']}
              onSearch={handleTagSearch}
              onDropdownVisibleChange={handleTagDropdown}
              onUpdate:value={(value: any) => updateSelectedTags((value || []) as string[])}
              v-slots={{
                tagRender: ({ value, closable, onClose }: any) => (
                  <span class="search-tag-selection">
                    <TagPill
                      name={String(value)}
                      text={getTagOption(String(value))?.label || String(value)}
                      description={getTagOption(String(value))?.description || undefined}
                      compact
                    />
                    {closable ? (
                      <button
                        type="button"
                        class="search-tag-selection__remove"
                        aria-label={`移除标签 ${String(value)}`}
                        onMousedown={(event: Event) => event.preventDefault()}
                        onClick={onClose}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ),
                default: () =>
                  tagOptions.value.map(tag => (
                    <Select.Option key={tag.value} value={tag.value}>
                      <TagPill
                        name={tag.value}
                        text={tag.label}
                        description={tag.description || undefined}
                        compact
                      />
                    </Select.Option>
                  ))
              }}
            />
          </div>

          {/* Toggle advanced filters */}
          <div class="search-advanced-toggle-row">
            <button
              type="button"
              class="search-advanced-toggle"
              aria-expanded={showAdvanced.value}
              aria-controls="discourse-search-advanced"
              onClick={() => {
                showAdvanced.value = !showAdvanced.value
              }}
            >
              <span>{showAdvanced.value ? '收起' : '展开'}高级筛选</span>
              <svg
                class={['search-advanced-toggle__icon', { expanded: showAdvanced.value }]}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Advanced filters */}
          {showAdvanced.value && (
            <div id="discourse-search-advanced" class="search-advanced-panel">
              {/* Search type toggles */}
              <div class="search-filter-section__title">搜索类型</div>
              <div class="search-toggle-grid">
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inTitle}
                    aria-label="只搜索标题"
                    onChange={checked => {
                      localFilters.value.inTitle = Boolean(checked)
                    }}
                  />
                  <span>标题内</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inFirst}
                    aria-label="只搜索首帖"
                    onChange={checked => {
                      localFilters.value.inFirst = Boolean(checked)
                    }}
                  />
                  <span>仅首帖</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inPinned}
                    aria-label="只搜索置顶内容"
                    onChange={checked => {
                      localFilters.value.inPinned = Boolean(checked)
                    }}
                  />
                  <span>置顶</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inWiki}
                    aria-label="只搜索 Wiki 内容"
                    onChange={checked => {
                      localFilters.value.inWiki = Boolean(checked)
                    }}
                  />
                  <span>Wiki</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inMessages}
                    aria-label="搜索私信"
                    onChange={checked => {
                      localFilters.value.inMessages = Boolean(checked)
                    }}
                  />
                  <span>私信</span>
                </div>
              </div>

              {/* My activity toggles */}
              <div class="search-filter-section__title">仅回访话题／帖子</div>
              <div class="search-toggle-grid">
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inPosted}
                    aria-label="只搜索我发布的内容"
                    onChange={checked => {
                      localFilters.value.inPosted = Boolean(checked)
                    }}
                  />
                  <span>我发布的</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inBookmarks}
                    aria-label="只搜索我的书签"
                    onChange={checked => {
                      localFilters.value.inBookmarks = Boolean(checked)
                    }}
                  />
                  <span>我的书签</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inLikes}
                    aria-label="只搜索我点赞的内容"
                    onChange={checked => {
                      localFilters.value.inLikes = Boolean(checked)
                    }}
                  />
                  <span>我点赞的</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inWatching}
                    aria-label="只搜索关注中的内容"
                    onChange={checked => {
                      localFilters.value.inWatching = Boolean(checked)
                    }}
                  />
                  <span>关注中</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inTracking}
                    aria-label="只搜索跟踪中的内容"
                    onChange={checked => {
                      localFilters.value.inTracking = Boolean(checked)
                    }}
                  />
                  <span>跟踪中</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inSeen}
                    aria-label="只搜索已读内容"
                    onChange={checked => {
                      const next = Boolean(checked)
                      localFilters.value.inSeen = next
                      if (next) localFilters.value.inUnseen = false
                    }}
                  />
                  <span>已读</span>
                </div>
                <div class="search-toggle">
                  <Switch
                    checked={localFilters.value.inUnseen}
                    aria-label="只搜索未读内容"
                    onChange={checked => {
                      const next = Boolean(checked)
                      localFilters.value.inUnseen = next
                      if (next) localFilters.value.inSeen = false
                    }}
                  />
                  <span>未读</span>
                </div>
              </div>

              {/* User filters */}
              <div class="search-filter-section__title">用户筛选</div>
              <div class="search-filter-grid search-filter-grid--three">
                <div class="search-field">
                  <span class="search-field__label">已指定给</span>
                  <Input
                    value={localFilters.value.assignedTo}
                    placeholder="用户名"
                    class="search-field__control"
                    aria-label="按指定用户筛选"
                    onUpdate:value={(value: string) => {
                      localFilters.value.assignedTo = value
                    }}
                  />
                </div>
                <div class="search-field">
                  <span class="search-field__label">群组</span>
                  <Input
                    value={localFilters.value.group}
                    placeholder="群组名称"
                    class="search-field__control"
                    aria-label="按群组筛选"
                    onUpdate:value={(value: string) => {
                      localFilters.value.group = value
                    }}
                  />
                </div>
              </div>

              {/* Date filters */}
              <div class="search-filter-section__title">时间范围</div>
              <div class="search-filter-grid search-filter-grid--two">
                <div class="search-field">
                  <span class="search-field__label">早于</span>
                  <Input
                    value={localFilters.value.before}
                    placeholder="YYYY-MM-DD"
                    class="search-field__control"
                    aria-label="早于指定日期"
                    onUpdate:value={(value: string) => {
                      localFilters.value.before = value
                    }}
                  />
                </div>
                <div class="search-field">
                  <span class="search-field__label">晚于</span>
                  <Input
                    value={localFilters.value.after}
                    placeholder="YYYY-MM-DD"
                    class="search-field__control"
                    aria-label="晚于指定日期"
                    onUpdate:value={(value: string) => {
                      localFilters.value.after = value
                    }}
                  />
                </div>
              </div>

              {/* Count filters */}
              <div class="search-filter-section__title">数量筛选</div>
              <div class="search-filter-grid search-filter-grid--four">
                <div class="search-field">
                  <span class="search-field__label">最少帖子</span>
                  <Input
                    value={localFilters.value.minPosts}
                    placeholder="数量"
                    class="search-field__control"
                    aria-label="最少帖子数"
                    onUpdate:value={(value: string) => {
                      localFilters.value.minPosts = value
                    }}
                  />
                </div>
                <div class="search-field">
                  <span class="search-field__label">最多帖子</span>
                  <Input
                    value={localFilters.value.maxPosts}
                    placeholder="数量"
                    class="search-field__control"
                    aria-label="最多帖子数"
                    onUpdate:value={(value: string) => {
                      localFilters.value.maxPosts = value
                    }}
                  />
                </div>
                <div class="search-field">
                  <span class="search-field__label">最少浏览</span>
                  <Input
                    value={localFilters.value.minViews}
                    placeholder="数量"
                    class="search-field__control"
                    aria-label="最少浏览量"
                    onUpdate:value={(value: string) => {
                      localFilters.value.minViews = value
                    }}
                  />
                </div>
                <div class="search-field">
                  <span class="search-field__label">最多浏览</span>
                  <Input
                    value={localFilters.value.maxViews}
                    placeholder="数量"
                    class="search-field__control"
                    aria-label="最多浏览量"
                    onUpdate:value={(value: string) => {
                      localFilters.value.maxViews = value
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <aside class="search-syntax-hint">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 17h2v-6h-2v6Zm1-15a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18.2A8.2 8.2 0 1 1 12 3.8a8.2 8.2 0 0 1 0 16.4ZM11 9h2V7h-2v2Z" />
            </svg>
            <span>
              支持 Discourse 高级语法（如
              in:title、order:latest、tags:tag、@username、assigned:user）。以上筛选会自动追加到查询。
            </span>
          </aside>
        </section>

        {props.state.errorMessage && (
          <div class="search-error" role="alert">
            {props.state.errorMessage}
          </div>
        )}

        <section
          class="search-results"
          aria-label="搜索结果"
          aria-live="polite"
          aria-busy={props.state.loading}
        >
          {props.state.posts.map(post => {
            const topic = topicMap.value.get(post.topic_id)
            const path = buildPath(post)
            return (
              <article
                key={post.id}
                class={['search-result', { 'search-result--clickable': Boolean(path) }]}
                role={path ? 'link' : undefined}
                data-discourse-url={path || undefined}
                tabindex={path ? 0 : undefined}
                onClick={path ? () => openResult(path) : undefined}
                onKeydown={(event: KeyboardEvent) => handleResultKeydown(event, path)}
              >
                <div class="search-result__header">
                  <h3 class="search-result__title">
                    {topic?.fancy_title || topic?.title || '话题'}
                  </h3>
                  <time class="search-result__time" datetime={post.created_at}>
                    {formatTime(post.created_at)}
                  </time>
                </div>
                <div class="search-result__meta">
                  <span class="search-result__chip">#{post.post_number}</span>
                  {post.username && <span>@{post.username}</span>}
                  {topic?.category_id && (
                    <span class="search-result__chip">分类 {topic.category_id}</span>
                  )}
                </div>
                {post.blurb && (
                  <div
                    class="search-result__excerpt"
                    innerHTML={sanitizeDiscourseHtml(post.blurb)}
                  />
                )}
              </article>
            )
          })}
          {!props.state.loading && props.state.posts.length === 0 && (
            <div class="search-results__empty" role="status">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.5 3a6.5 6.5 0 1 0 3.99 11.63L19.86 21 21 19.86l-6.37-6.37A6.5 6.5 0 0 0 9.5 3Zm0 1.8a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Z" />
              </svg>
              <strong>暂无搜索结果</strong>
              <span>尝试减少筛选条件或使用更宽泛的关键词。</span>
            </div>
          )}
        </section>

        {props.state.hasMore && (
          <div class="search-load-more">
            <Button
              class="search-load-more__button"
              onClick={() => emit('loadMore')}
              loading={props.state.loading}
            >
              加载更多
            </Button>
          </div>
        )}
      </div>
    )
  }
})
