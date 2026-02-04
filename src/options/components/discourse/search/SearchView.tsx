import { defineComponent, ref, computed, watch } from 'vue'
import { Button, Input, Select, Switch, Tag } from 'ant-design-vue'

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

    const filterCategoryOption = (
      input: string,
      option?: { label?: string; value?: string; id?: number }
    ) => {
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
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-gray-500">标题内</span>
              <Switch
                size="small"
                checked={localFilters.value.inTitle}
                onChange={(checked: boolean) => {
                  localFilters.value.inTitle = checked
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">仅首帖</span>
              <Switch
                size="small"
                checked={localFilters.value.inFirst}
                onChange={(checked: boolean) => {
                  localFilters.value.inFirst = checked
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">状态</span>
              <Select
                size="small"
                value={localFilters.value.status}
                class="w-28"
                options={[
                  { value: '', label: '不限' },
                  { value: 'open', label: '开放' },
                  { value: 'closed', label: '已关闭' }
                ]}
                onChange={(value: 'open' | 'closed' | '') => {
                  localFilters.value.status = value
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">排序</span>
              <Select
                size="small"
                value={localFilters.value.order}
                class="w-28"
                options={[
                  { value: '', label: '默认' },
                  { value: 'latest', label: '最新' },
                  { value: 'likes', label: '点赞' },
                  { value: 'views', label: '浏览' }
                ]}
                onChange={(value: 'latest' | 'likes' | 'views' | '') => {
                  localFilters.value.order = value
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">分类</span>
              <Select
                size="small"
                mode="combobox"
                showSearch
                allowClear
                class="w-full"
                value={localFilters.value.category || undefined}
                placeholder="分类 ID 或 slug"
                options={categoryOptions.value}
                filterOption={filterCategoryOption}
                onUpdate:value={(value: string | undefined) => {
                  localFilters.value.category = value ? value.trim() : ''
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">标签</span>
              <Select
                size="small"
                class="w-full"
                mode="tags"
                showSearch
                value={selectedTags.value}
                filterOption={false}
                notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                placeholder="搜索或输入标签"
                tokenSeparators={[',', ' ']}
                onSearch={handleTagSearch}
                onDropdownVisibleChange={handleTagDropdown}
                onUpdate:value={(value: string[]) => updateSelectedTags(value)}
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
          </div>
          <div class="text-xs text-gray-400">
            支持 Discourse 高级语法（如
            in:title、order:latest、tags:tag）。以上筛选会自动追加到查询。
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
