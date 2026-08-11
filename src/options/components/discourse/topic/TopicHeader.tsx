import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { message, Select, TreeSelect } from 'ant-design-vue'

import type { DiscourseCategory, DiscourseTopicDetail } from '../types'
import { searchTags, updateTopicTitle } from '../actions'
import { extractData, formatTime, pageFetch } from '../utils'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'

const normalizeRawCategory = (raw: any): DiscourseCategory | null => {
  if (!raw || typeof raw.id !== 'number') return null
  return {
    id: raw.id,
    name: String(raw.name || `category-${raw.id}`),
    slug: String(raw.slug || raw.id),
    color: String(raw.color || '0088CC'),
    text_color: String(raw.text_color || 'FFFFFF'),
    topic_count: Number(raw.topic_count || 0),
    parent_category_id: raw.parent_category_id ?? null,
    subcategory_ids: Array.isArray(raw.subcategory_ids) ? raw.subcategory_ids : null
  }
}

const toCategoryTreeData = (categories: DiscourseCategory[]) => {
  const nodeMap = new Map<number, { title: string; value: number; key: number; children: any[] }>()
  const childrenByParent = new Map<number, Set<number>>()

  categories.forEach(cat => {
    nodeMap.set(cat.id, { title: cat.name, value: cat.id, key: cat.id, children: [] })
  })
  categories.forEach(cat => {
    if (!cat.parent_category_id || !nodeMap.has(cat.parent_category_id)) return
    const children = childrenByParent.get(cat.parent_category_id) || new Set<number>()
    children.add(cat.id)
    childrenByParent.set(cat.parent_category_id, children)
  })

  const hasParent = new Set<number>()
  childrenByParent.forEach((childIds, parentId) => {
    const parent = nodeMap.get(parentId)
    if (!parent) return
    childIds.forEach(childId => {
      const child = nodeMap.get(childId)
      if (!child) return
      if (!parent.children.some(item => item.value === child.value)) parent.children.push(child)
      hasParent.add(childId)
    })
  })

  const roots: Array<{ title: string; value: number; key: number; children: any[] }> = []
  nodeMap.forEach((node, id) => {
    if (!hasParent.has(id)) roots.push(node)
  })
  return roots
}

export default defineComponent({
  name: 'TopicHeader',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true },
    baseUrl: { type: String, required: true }
  },
  setup(props) {
    const editing = ref(false)
    const draftTitle = ref(props.topic.title)
    const draftCategoryId = ref<number | null>(props.topic.category_id ?? null)
    const draftTags = ref<string[]>(Array.isArray(props.topic.tags) ? [...props.topic.tags] : [])
    const saving = ref(false)
    const inputRef = ref<HTMLInputElement | null>(null)

    const categories = ref<DiscourseCategory[]>([])
    const categoriesLoading = ref(false)
    const canCreateTag = ref(true)
    const tagOptions = ref<Array<{ value: string; label: string }>>([])
    const tagSearching = ref(false)
    let tagSearchSequence = 0

    const isPrivateMessage = computed(() => props.topic.archetype === 'private_message')

    watch(
      () => [props.topic.id, props.topic.title, props.topic.category_id, props.topic.tags] as const,
      () => {
        if (!editing.value) {
          draftTitle.value = props.topic.title
          draftCategoryId.value = props.topic.category_id ?? null
          draftTags.value = Array.isArray(props.topic.tags) ? [...props.topic.tags] : []
        }
      }
    )

    const loadCategories = async () => {
      if (categories.value.length > 0 || categoriesLoading.value) return
      categoriesLoading.value = true
      try {
        let list: DiscourseCategory[] = []
        if (isLinuxDoUrl(props.baseUrl)) {
          await ensurePreloadedCategoriesLoaded()
          list = getAllPreloadedCategories()
            .map(normalizeRawCategory)
            .filter((cat): cat is DiscourseCategory => Boolean(cat))
        } else {
          const result = await pageFetch<any>(`${props.baseUrl}/categories.json`)
          const data = extractData(result)
          const rawList = Array.isArray(data?.category_list?.categories)
            ? data.category_list.categories
            : []
          list = rawList.map(normalizeRawCategory).filter(Boolean)
        }
        // 保证当前分区一定在列表中（即使快照/接口未返回）
        const currentId = props.topic.category_id
        if (currentId && !list.some(cat => cat.id === currentId)) {
          const current = props.topic.category
          if (current && typeof current.id === 'number') {
            list = [
              {
                id: current.id,
                name: current.name || String(current.id),
                slug: current.slug || String(current.id),
                color: current.color || '0088CC',
                text_color: current.text_color || 'FFFFFF',
                topic_count: 0,
                parent_category_id: null,
                subcategory_ids: null
              },
              ...list
            ]
          }
        }
        categories.value = list
      } catch (error) {
        console.warn('[DiscourseBrowser] load categories for topic edit failed:', error)
      } finally {
        categoriesLoading.value = false
      }
    }

    // 标签创建权限：/site.json 的 can_create_tag（无权限时仅允许选择已有标签）
    const loadTagCreationPermission = async () => {
      try {
        const result = await pageFetch<any>(`${props.baseUrl}/site.json`)
        const data = extractData(result)
        if (data && typeof data.can_create_tag === 'boolean') {
          canCreateTag.value = data.can_create_tag
        }
      } catch {
        // 无法确认时允许自由输入，由站点在提交时校验
      }
    }

    const beginEdit = () => {
      draftTitle.value = props.topic.title
      draftCategoryId.value = props.topic.category_id ?? null
      draftTags.value = Array.isArray(props.topic.tags) ? [...props.topic.tags] : []
      editing.value = true
      void nextTick(() => inputRef.value?.focus())
      if (!isPrivateMessage.value) {
        void loadCategories()
        void loadTagCreationPermission()
      }
    }

    const cancelEdit = () => {
      if (saving.value) return
      draftTitle.value = props.topic.title
      draftCategoryId.value = props.topic.category_id ?? null
      draftTags.value = Array.isArray(props.topic.tags) ? [...props.topic.tags] : []
      editing.value = false
    }

    const handleTagSearch = async (query: string) => {
      const sequence = ++tagSearchSequence
      if (!query.trim()) {
        tagOptions.value = []
        return
      }
      tagSearching.value = true
      try {
        const results = await searchTags(props.baseUrl, query.trim(), draftCategoryId.value, 8)
        if (sequence !== tagSearchSequence) return
        tagOptions.value = results.map(item => ({ value: item.name, label: item.name }))
      } catch {
        if (sequence !== tagSearchSequence) return
        tagOptions.value = []
      } finally {
        if (sequence === tagSearchSequence) tagSearching.value = false
      }
    }

    const saveTopic = async () => {
      if (saving.value) return
      const title = draftTitle.value.trim()
      if (!title) return
      saving.value = true
      const originalTitle = props.topic.title
      try {
        const options: { categoryId?: number | null; tags?: string[] } = {}
        if (!isPrivateMessage.value) {
          const originalCategoryId = props.topic.category_id ?? null
          if (draftCategoryId.value !== originalCategoryId) {
            options.categoryId = draftCategoryId.value
          }
          const originalTags = Array.isArray(props.topic.tags) ? [...props.topic.tags].sort() : []
          const nextTags = [...draftTags.value].sort()
          if (nextTags.join('\u0000') !== originalTags.join('\u0000')) {
            options.tags = draftTags.value
          }
        }
        const data = await updateTopicTitle(
          props.baseUrl,
          props.topic.id,
          title,
          originalTitle,
          Object.keys(options).length > 0 ? options : undefined
        )
        props.topic.title = String(data?.title || title)
        props.topic.fancy_title = String(data?.fancy_title || data?.title || title)
        if (!isPrivateMessage.value) {
          if (options.categoryId !== undefined) {
            props.topic.category_id = options.categoryId
            const category = categories.value.find(cat => cat.id === options.categoryId)
            props.topic.category = category
              ? {
                  id: category.id,
                  name: category.name,
                  slug: category.slug,
                  color: category.color,
                  text_color: category.text_color
                }
              : null
          }
          if (options.tags !== undefined) {
            props.topic.tags = [...options.tags]
          }
        }
        editing.value = false
        message.success('话题已更新')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '修改话题失败')
      } finally {
        saving.value = false
      }
    }

    const categoryTreeData = computed(() => toCategoryTreeData(categories.value))

    return () => (
      <header class="topic-header">
        <span class="topic-header__eyebrow">讨论主题</span>
        {editing.value ? (
          <form
            class="topic-header__edit-form"
            onSubmit={(event: Event) => {
              event.preventDefault()
              void saveTopic()
            }}
          >
            <label class="topic-header__field">
              <span class="topic-header__field-label">标题</span>
              <input
                ref={inputRef}
                value={draftTitle.value}
                maxlength="255"
                aria-label="话题标题"
                disabled={saving.value}
                onInput={(event: Event) => {
                  draftTitle.value = (event.target as HTMLInputElement).value
                }}
                onKeydown={(event: KeyboardEvent) => {
                  if (event.key === 'Escape') cancelEdit()
                }}
              />
            </label>
            {!isPrivateMessage.value && (
              <label class="topic-header__field">
                <span class="topic-header__field-label">分区</span>
                <TreeSelect
                  value={draftCategoryId.value}
                  treeData={categoryTreeData.value as any}
                  loading={categoriesLoading.value}
                  placeholder="选择分区"
                  allowClear
                  showSearch
                  treeNodeFilterProp="title"
                  disabled={saving.value}
                  onChange={(value: number | null) => {
                    draftCategoryId.value = value ?? null
                  }}
                />
              </label>
            )}
            {!isPrivateMessage.value && (
              <label class="topic-header__field">
                <span class="topic-header__field-label">标签</span>
                <Select
                  value={draftTags.value}
                  mode={canCreateTag.value ? 'tags' : 'multiple'}
                  options={tagOptions.value}
                  placeholder={
                    canCreateTag.value ? '输入或搜索标签（可新建）' : '搜索并选择已有标签'
                  }
                  showSearch
                  filterOption={false}
                  loading={tagSearching.value}
                  disabled={saving.value}
                  maxTagCount="responsive"
                  onChange={(value: unknown) => {
                    draftTags.value = Array.isArray(value) ? value.map(item => String(item)) : []
                  }}
                  onSearch={handleTagSearch}
                />
              </label>
            )}
            <div class="topic-header__edit-actions">
              <button type="submit" disabled={saving.value || !draftTitle.value.trim()}>
                {saving.value ? '保存中…' : '保存'}
              </button>
              <button type="button" disabled={saving.value} onClick={cancelEdit}>
                取消
              </button>
            </div>
          </form>
        ) : (
          <div class="topic-header__title-row">
            <h1 class="topic-header__title">{props.topic.fancy_title || props.topic.title}</h1>
            {props.topic.details?.can_edit && (
              <button
                type="button"
                class="topic-header__edit"
                title="编辑话题标题、分区与标签"
                aria-label="编辑话题标题、分区与标签"
                onClick={beginEdit}
              >
                ✎
              </button>
            )}
          </div>
        )}
        <div class="topic-header__meta">
          <span class="topic-header__meta-item">{props.topic.posts_count} 回复</span>
          <span class="topic-header__meta-item">
            创建于{' '}
            <time datetime={props.topic.created_at}>{formatTime(props.topic.created_at)}</time>
          </span>
        </div>
      </header>
    )
  }
})
