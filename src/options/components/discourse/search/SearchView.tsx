import { defineComponent, ref, computed, watch } from 'vue'
import { Button, Input, Select, Switch, Tag } from 'ant-design-vue'

import type {
  SearchState,
  DiscourseSearchFilters,
  DiscourseSearchPost,
  DiscourseSearchTopic
} from '../types'
import { formatTime } from '../utils'

export default defineComponent({
  name: 'SearchView',
  props: {
    state: { type: Object as () => SearchState, required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['search', 'loadMore', 'open'],
  setup(props, { emit }) {
    const localQuery = ref(props.state.query)
    const localFilters = ref<DiscourseSearchFilters>({ ...props.state.filters })

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
              <Input
                size="small"
                value={localFilters.value.category}
                placeholder="分类 ID 或 slug"
                onUpdate:value={(value: string) => {
                  localFilters.value.category = value
                }}
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">标签</span>
              <Input
                size="small"
                value={localFilters.value.tags}
                placeholder="tag1,tag2"
                onUpdate:value={(value: string) => {
                  localFilters.value.tags = value
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
