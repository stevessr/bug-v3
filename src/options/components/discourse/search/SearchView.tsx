import { defineComponent, ref, computed, watch } from 'vue'
import {
  Button,
  Input,
  Select,
  Switch,
  Tag
} from 'ant-design-vue'

import type {
  SearchState,
  DiscourseSearchFilters,
  DiscourseSearchPost,
  DiscourseSearchTopic,
  DiscourseCategory
} from '../types'
import { searchTags } from '../actions'
import { formatTime } from '../utils'
import TagPill from '../layout/TagPill'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'

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

    return () => (
      <div class="search-view space-y-4">
        <div class="search-panel rounded-lg border dark:border-gray-700 p-4 space-y-3">
          <div class="flex items-center gap-2">
            <Input
              value={localQuery.value}
              placeholder="搜索话题、回复、用户..."
              onUpdate:value={(value: string) => {
                localQuery.value = value
              }}
              onPressEnter={handleSearch}
            />
            <Button type="primary" onClick={handleSearch} loading={props.state.loading}>
              搜索
            </Button>
          </div>

          {/* Basic filters row */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-gray-500 shrink-0">排序</span>
              <Select
                size="small"
                value={localFilters.value.order}
                class="flex-1"
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
            <div class="flex items-center gap-2">
              <span class="text-gray-500 shrink-0">发帖人</span>
              <Input
                size="small"
                value={localFilters.value.postedBy}
                placeholder="用户名"
                class="flex-1"
                onUpdate:value={(value: string) => {
                  localFilters.value.postedBy = value
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500 shrink-0">状态</span>
              <Select
                size="small"
                value={localFilters.value.status}
                class="flex-1"
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
            <div class="flex items-center gap-2">
              <span class="text-gray-500 shrink-0">分类</span>
              <Select
                size="small"
                mode="SECRET_COMBOBOX_MODE_DO_NOT_USE"
                showSearch
                allowClear
                class="flex-1"
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
          <div class="flex items-center gap-2 text-xs">
            <span class="text-gray-500 shrink-0">标签</span>
            <Select
              size="small"
              class="flex-1"
              mode="tags"
              showSearch
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
                  <span class="inline-flex items-center gap-1 mr-1">
                    <TagPill
                      name={String(value)}
                      text={getTagOption(String(value))?.label || String(value)}
                      description={getTagOption(String(value))?.description || null}
                      compact
                    />
                    {closable ? (
                      <button
                        type="button"
                        class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                        description={tag.description || null}
                        compact
                      />
                    </Select.Option>
                  ))
              }}
            />
          </div>

          {/* Toggle advanced filters */}
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
              onClick={() => {
                showAdvanced.value = !showAdvanced.value
              }}
            >
              <span>{showAdvanced.value ? '收起' : '展开'}高级筛选</span>
              <svg
                class={['w-3 h-3 transition-transform', showAdvanced.value ? 'rotate-180' : '']}
                viewBox="0 0 20 20"
                fill="currentColor"
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
            <div class="space-y-3 pt-2 border-t dark:border-gray-700">
              {/* Search type toggles */}
              <div class="text-xs text-gray-500 font-medium">搜索类型</div>
              <div class="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inTitle}
                    onChange={checked => {
                      localFilters.value.inTitle = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">标题内</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inFirst}
                    onChange={checked => {
                      localFilters.value.inFirst = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">仅首帖</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inPinned}
                    onChange={checked => {
                      localFilters.value.inPinned = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">置顶</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inWiki}
                    onChange={checked => {
                      localFilters.value.inWiki = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">Wiki</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inMessages}
                    onChange={checked => {
                      localFilters.value.inMessages = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">私信</span>
                </div>
              </div>

              {/* My activity toggles */}
              <div class="text-xs text-gray-500 font-medium">仅回访话题/帖子</div>
              <div class="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inPosted}
                    onChange={checked => {
                      localFilters.value.inPosted = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">我发布的</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inBookmarks}
                    onChange={checked => {
                      localFilters.value.inBookmarks = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">我的书签</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inLikes}
                    onChange={checked => {
                      localFilters.value.inLikes = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">我点赞的</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inWatching}
                    onChange={checked => {
                      localFilters.value.inWatching = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">关注中</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inTracking}
                    onChange={checked => {
                      localFilters.value.inTracking = Boolean(checked)
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">跟踪中</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inSeen}
                    onChange={checked => {
                      const next = Boolean(checked)
                      localFilters.value.inSeen = next
                      if (next) localFilters.value.inUnseen = false
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">已读</span>
                </div>
                <div class="flex items-center gap-1">
                  <Switch
                    size="small"
                    checked={localFilters.value.inUnseen}
                    onChange={checked => {
                      const next = Boolean(checked)
                      localFilters.value.inUnseen = next
                      if (next) localFilters.value.inSeen = false
                    }}
                  />
                  <span class="text-gray-600 dark:text-gray-400">未读</span>
                </div>
              </div>

              {/* User filters */}
              <div class="text-xs text-gray-500 font-medium">用户筛选</div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">已指定给</span>
                  <Input
                    size="small"
                    value={localFilters.value.assignedTo}
                    placeholder="用户名"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.assignedTo = value
                    }}
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">群组</span>
                  <Input
                    size="small"
                    value={localFilters.value.group}
                    placeholder="群组名称"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.group = value
                    }}
                  />
                </div>
              </div>

              {/* Date filters */}
              <div class="text-xs text-gray-500 font-medium">时间范围</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">早于</span>
                  <Input
                    size="small"
                    value={localFilters.value.before}
                    placeholder="YYYY-MM-DD"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.before = value
                    }}
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">晚于</span>
                  <Input
                    size="small"
                    value={localFilters.value.after}
                    placeholder="YYYY-MM-DD"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.after = value
                    }}
                  />
                </div>
              </div>

              {/* Count filters */}
              <div class="text-xs text-gray-500 font-medium">数量筛选</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">最少帖子</span>
                  <Input
                    size="small"
                    value={localFilters.value.minPosts}
                    placeholder="数量"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.minPosts = value
                    }}
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">最多帖子</span>
                  <Input
                    size="small"
                    value={localFilters.value.maxPosts}
                    placeholder="数量"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.maxPosts = value
                    }}
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">最少浏览</span>
                  <Input
                    size="small"
                    value={localFilters.value.minViews}
                    placeholder="数量"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.minViews = value
                    }}
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 shrink-0">最多浏览</span>
                  <Input
                    size="small"
                    value={localFilters.value.maxViews}
                    placeholder="数量"
                    class="flex-1"
                    onUpdate:value={(value: string) => {
                      localFilters.value.maxViews = value
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div class="text-xs text-gray-400">
            支持 Discourse 高级语法（如
            in:title、order:latest、tags:tag、@username、assigned:user）。以上筛选会自动追加到查询。
          </div>
        </div>

        {props.state.errorMessage && (
          <div class="text-sm text-red-500">{props.state.errorMessage}</div>
        )}

        <div class="search-results space-y-3">
          {props.state.posts.map(post => {
            const topic = topicMap.value.get(post.topic_id)
            const path = buildPath(post)
            return (
              <div
                key={post.id}
                class="rounded-lg border dark:border-gray-700 p-3 bg-white dark:bg-gray-800 cursor-pointer"
                onClick={() => path && emit('open', path)}
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium dark:text-white">
                    {topic?.fancy_title || topic?.title || '话题'}
                  </div>
                  <span class="text-xs text-gray-400">{formatTime(post.created_at)}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  <span>#{post.post_number}</span>
                  {post.username && <span class="ml-2">@{post.username}</span>}
                  {topic?.category_id && <Tag class="ml-2">分类 {topic.category_id}</Tag>}
                </div>
                {post.blurb && (
                  <div
                    class="text-sm text-gray-600 dark:text-gray-300 mt-2"
                    innerHTML={post.blurb}
                  />
                )}
              </div>
            )
          })}
          {!props.state.loading && props.state.posts.length === 0 && (
            <div class="text-gray-500">暂无搜索结果</div>
          )}
        </div>

        {props.state.hasMore && (
          <div class="flex justify-center">
            <Button onClick={() => emit('loadMore')} loading={props.state.loading}>
              加载更多
            </Button>
          </div>
        )}
      </div>
    )
  }
})
