import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { message, Select, TreeSelect } from 'ant-design-vue'

import type { DiscourseCategory, DiscourseTopicDetail } from '../types'
import { searchTags, updateTopicTitle } from '../actions'
import { getDiscourseIconHref } from '../layout/iconSprite'
import TagPill from '../layout/TagPill'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  getPreloadedCategory,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'
import { resolveDiscourseHttpUrl } from '../navigation'
import { extractData, formatTime, pageFetch } from '../utils'

type CategoryTreeNode = {
  title: string
  value: number
  key: number
  children: CategoryTreeNode[]
  icon?: string | null
  emoji?: string | null
  color?: string | null
  logoUrl?: string
}

type TopicTag = {
  name: string
  text: string
  description?: string | null
}

type TagOption = TopicTag & { value: string; label: string }

const normalizeRawCategory = (raw: any): DiscourseCategory | null => {
  const id = Number(raw?.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    id,
    name: String(raw.name || `category-${id}`),
    slug: String(raw.slug || id),
    color: String(raw.color || '0088CC'),
    text_color: String(raw.text_color || 'FFFFFF'),
    topic_count: Number(raw.topic_count || 0),
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

const normalizeTopicTag = (raw: unknown): TopicTag | null => {
  if (typeof raw === 'string') {
    const value = raw.trim()
    return value ? { name: value, text: value } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const value = raw as { name?: unknown; text?: unknown; slug?: unknown; description?: unknown }
  const name = String(value.name || value.slug || value.text || '').trim()
  if (!name) return null
  const text = String(value.text || value.name || value.slug || name).trim() || name
  return {
    name,
    text,
    description: typeof value.description === 'string' ? value.description : null
  }
}

const normalizeTopicTags = (raw: unknown): TopicTag[] => {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw
    .map(normalizeTopicTag)
    .filter((tag): tag is TopicTag => Boolean(tag))
    .filter(tag => {
      const key = tag.name.toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const tagNames = (raw: unknown) => normalizeTopicTags(raw).map(tag => tag.name)

const categoryColor = (color?: string | null) => {
  const normalized = (color || '').trim().replace(/^#/, '')
  return /^[\da-f]{3,8}$/i.test(normalized) ? `#${normalized}` : '#94a3b8'
}

const toCategoryTreeData = (categories: DiscourseCategory[]): CategoryTreeNode[] => {
  const nodeMap = new Map<number, CategoryTreeNode>()
  const childrenByParent = new Map<number, Set<number>>()

  const linkChild = (parentId: number, childId: number) => {
    const children = childrenByParent.get(parentId) || new Set<number>()
    children.add(childId)
    childrenByParent.set(parentId, children)
  }

  categories.forEach(cat => {
    nodeMap.set(cat.id, {
      title: cat.name,
      value: cat.id,
      key: cat.id,
      icon: cat.icon,
      emoji: cat.emoji,
      color: cat.color,
      logoUrl: cat.uploaded_logo?.url || cat.uploaded_logo_dark?.url || '',
      children: []
    })
  })
  categories.forEach(cat => {
    if (cat.parent_category_id && nodeMap.has(cat.parent_category_id)) {
      linkChild(cat.parent_category_id, cat.id)
    }
    cat.subcategory_ids?.forEach(childId => {
      if (nodeMap.has(childId)) linkChild(cat.id, childId)
    })
  })

  const hasParent = new Set<number>()
  childrenByParent.forEach((childIds, parentId) => {
    const parent = nodeMap.get(parentId)
    if (!parent) return
    childIds.forEach(childId => {
      const child = nodeMap.get(childId)
      if (!child || parent.children.some(item => item.value === child.value)) return
      parent.children.push(child)
      hasParent.add(childId)
    })
  })

  const roots: CategoryTreeNode[] = []
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
  emits: ['navigate'],
  setup(props, { emit }) {
    const editing = ref(false)
    const draftTitle = ref(props.topic.title)
    const draftCategoryId = ref<number | null>(props.topic.category_id ?? null)
    const draftTags = ref<string[]>(tagNames(props.topic.tags))
    const saving = ref(false)
    const inputRef = ref<HTMLInputElement | null>(null)

    const categories = ref<DiscourseCategory[]>([])
    const categoriesLoading = ref(false)
    const canCreateTag = ref(true)
    const tagOptions = ref<TagOption[]>([])
    const tagSearching = ref(false)
    let tagSearchSequence = 0
    let categoryLoadSequence = 0
    let categoriesOrigin = ''

    const isPrivateMessage = computed(() => props.topic.archetype === 'private_message')
    const topicTags = computed(() => normalizeTopicTags(props.topic.tags))
    const displayedCategory = computed(() => {
      const rawCategory = normalizeRawCategory(props.topic.category)
      const categoryId = props.topic.category_id ?? rawCategory?.id ?? null
      if (!categoryId) return rawCategory
      const loadedCategory = categories.value.find(category => category.id === categoryId)
      if (loadedCategory) return loadedCategory

      // Linux.do topic payloads commonly only include category_id. Resolve the
      // packaged live-definition fallback synchronously so the major board
      // logo/icon does not wait for the background category request.
      if (isLinuxDoUrl(props.baseUrl)) {
        const fallback = normalizeRawCategory(getPreloadedCategory(categoryId, rawCategory?.slug))
        if (fallback) return fallback
      }
      return rawCategory
    })

    const loadCategories = async () => {
      const origin = props.baseUrl.replace(/\/+$/, '')
      if (categories.value.length > 0 && categoriesOrigin === origin) return

      const sequence = ++categoryLoadSequence
      categoriesLoading.value = true
      try {
        let list: DiscourseCategory[] = []
        if (isLinuxDoUrl(props.baseUrl)) {
          await ensurePreloadedCategoriesLoaded()
          list = getAllPreloadedCategories()
            .map(normalizeRawCategory)
            .filter((category): category is DiscourseCategory => Boolean(category))
        } else {
          const result = await pageFetch<any>(`${origin}/categories.json`)
          const data = extractData(result)
          const rawList: unknown[] = Array.isArray(data?.category_list?.categories)
            ? data.category_list.categories
            : []
          list = rawList
            .map(raw => normalizeRawCategory(raw))
            .filter((category): category is DiscourseCategory => Boolean(category))
        }

        // Some topic detail payloads only carry a compact category object. It
        // is still useful as a fallback while an old snapshot lacks the row.
        const currentCategory = normalizeRawCategory(props.topic.category)
        const currentId = props.topic.category_id ?? currentCategory?.id
        if (currentId && !list.some(category => category.id === currentId) && currentCategory) {
          list = [currentCategory, ...list]
        }

        if (sequence !== categoryLoadSequence) return
        categories.value = list
        categoriesOrigin = origin
      } catch (error) {
        if (sequence === categoryLoadSequence) {
          console.warn('[DiscourseBrowser] load categories for topic header failed:', error)
        }
      } finally {
        if (sequence === categoryLoadSequence) categoriesLoading.value = false
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

    watch(
      () => [props.baseUrl, props.topic.id, props.topic.category_id, props.topic.category] as const,
      () => {
        if (!isPrivateMessage.value && (props.topic.category_id || props.topic.category?.id)) {
          void loadCategories()
        }
      },
      { immediate: true }
    )

    watch(
      () => [props.topic.id, props.topic.title, props.topic.category_id, props.topic.tags] as const,
      () => {
        if (!editing.value) {
          draftTitle.value = props.topic.title
          draftCategoryId.value = props.topic.category_id ?? null
          draftTags.value = tagNames(props.topic.tags)
        }
      }
    )

    const beginEdit = () => {
      draftTitle.value = props.topic.title
      draftCategoryId.value = props.topic.category_id ?? null
      draftTags.value = tagNames(props.topic.tags)
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
      draftTags.value = tagNames(props.topic.tags)
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
        tagOptions.value = results
          .map((item): TagOption | null => {
            const name = String(item.name || item.text || '').trim()
            const text = String(item.text || item.name || '').trim() || name
            return name
              ? {
                  value: name,
                  label: text,
                  name,
                  text,
                  description: item.description || null
                }
              : null
          })
          .filter((tag): tag is TagOption => tag !== null)
      } catch {
        if (sequence !== tagSearchSequence) return
        tagOptions.value = []
      } finally {
        if (sequence === tagSearchSequence) tagSearching.value = false
      }
    }

    const tagForDraftValue = (value: string): TopicTag => {
      const normalized = value.trim()
      return (
        tagOptions.value.find(tag => tag.value === normalized) ||
        topicTags.value.find(tag => tag.name === normalized) || {
          name: normalized,
          text: normalized
        }
      )
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
          const originalTags = [...tagNames(props.topic.tags)].sort()
          const nextTags = [...draftTags.value].sort()
          if (nextTags.join('\u0000') !== originalTags.join('\u0000')) {
            options.tags = [...draftTags.value]
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
            const category = categories.value.find(category => category.id === options.categoryId)
            props.topic.category = category
              ? {
                  id: category.id,
                  name: category.name,
                  slug: category.slug,
                  color: category.color,
                  text_color: category.text_color,
                  style_type: category.style_type,
                  icon: category.icon,
                  emoji: category.emoji,
                  uploaded_logo: category.uploaded_logo,
                  uploaded_logo_dark: category.uploaded_logo_dark
                }
              : null
          }
          if (options.tags !== undefined) {
            props.topic.tags = tagNames(data?.tags ?? options.tags)
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

    const getCategoryImageUrl = (url?: string) =>
      url ? resolveDiscourseHttpUrl(url, props.baseUrl) || '' : ''

    const renderCategoryIcon = (category: {
      color?: string | null
      icon?: string | null
      emoji?: string | null
      logoUrl?: string
      uploaded_logo?: { url: string } | null
      uploaded_logo_dark?: { url: string } | null
    }) => {
      const logoUrl =
        category.logoUrl || category.uploaded_logo?.url || category.uploaded_logo_dark?.url
      const imageUrl = getCategoryImageUrl(logoUrl)
      const color = categoryColor(category.color)
      return (
        <span class="topic-category-icon" style={{ color }} aria-hidden="true">
          {imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : category.emoji ? (
            <span class="topic-category-icon__emoji">{category.emoji}</span>
          ) : category.icon ? (
            <svg viewBox="0 0 24 24">
              <use href={getDiscourseIconHref(category.icon)} />
            </svg>
          ) : (
            <span class="topic-category-icon__dot" style={{ backgroundColor: color }} />
          )}
        </span>
      )
    }

    const renderCategoryTreeTitle = (node: any) => {
      const category = (node?.dataRef ?? node) as CategoryTreeNode
      if (!category?.title) return <span>{String(category || '')}</span>
      return (
        <span
          class="topic-category-tree-option"
          data-category-color={categoryColor(category.color)}
        >
          {renderCategoryIcon(category)}
          <span>{category.title}</span>
        </span>
      )
    }

    const getCategoryUrl = (category: DiscourseCategory) => {
      const origin = props.baseUrl.replace(/\/+$/, '')
      const slug = category.slug?.trim() || 'uncategorized'
      return `${origin}/c/${encodeURIComponent(slug)}/${category.id}`
    }

    const getTagUrl = (tag: TopicTag) =>
      `${props.baseUrl.replace(/\/+$/, '')}/tag/${encodeURIComponent(tag.name)}`

    return () => {
      const category = displayedCategory.value
      const tags = topicTags.value
      return (
        <header class="topic-header">
          <span class="topic-header__eyebrow">讨论主题</span>
          {!editing.value && (category || tags.length > 0) && (
            <div class="topic-header__context" aria-label="话题分区与标签">
              {category && (
                <button
                  type="button"
                  class="topic-header__context-category"
                  data-category-color={categoryColor(category.color)}
                  data-discourse-url={getCategoryUrl(category)}
                  style={{
                    color: categoryColor(category.color),
                    borderColor: categoryColor(category.color)
                  }}
                  aria-label={`查看分类：${category.name}`}
                  title={`查看分类：${category.name}`}
                  onClick={() => emit('navigate', getCategoryUrl(category))}
                >
                  {renderCategoryIcon(category)}
                  <span>{category.name}</span>
                </button>
              )}
              {tags.map(tag => (
                <button
                  key={tag.name}
                  type="button"
                  class="topic-header__context-tag"
                  data-discourse-url={getTagUrl(tag)}
                  aria-label={`查看标签：${tag.text || tag.name}`}
                  title={`查看标签：${tag.text || tag.name}`}
                  onClick={() => emit('navigate', getTagUrl(tag))}
                >
                  <TagPill
                    name={tag.name}
                    text={tag.text}
                    description={tag.description || undefined}
                    clickable
                    compact
                    truncate
                  />
                </button>
              ))}
            </div>
          )}
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
                    treeDefaultExpandAll
                    treeNodeFilterProp="title"
                    disabled={saving.value}
                    onChange={(value: number | null) => {
                      draftCategoryId.value = value ?? null
                    }}
                    v-slots={{ title: renderCategoryTreeTitle }}
                  />
                </label>
              )}
              {!isPrivateMessage.value && (
                <label class="topic-header__field">
                  <span class="topic-header__field-label">标签</span>
                  <Select
                    value={draftTags.value}
                    mode={canCreateTag.value ? 'tags' : 'multiple'}
                    placeholder={
                      canCreateTag.value ? '输入或搜索标签（可新建）' : '搜索并选择已有标签'
                    }
                    showSearch
                    filterOption={false}
                    loading={tagSearching.value}
                    disabled={saving.value}
                    maxTagCount="responsive"
                    onChange={(value: unknown) => {
                      draftTags.value = tagNames(value)
                    }}
                    onSearch={handleTagSearch}
                    v-slots={{
                      tagRender: ({ value, closable, onClose }: any) => {
                        const tag = tagForDraftValue(String(value))
                        return (
                          <span class="topic-header__selected-tag">
                            <TagPill
                              name={tag.name}
                              text={tag.text}
                              description={tag.description || undefined}
                              compact
                              truncate
                            />
                            {closable ? (
                              <button
                                type="button"
                                aria-label={`移除标签 ${tag.text}`}
                                onMousedown={(event: Event) => event.preventDefault()}
                                onClick={onClose}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        )
                      },
                      default: () =>
                        tagOptions.value.map(tag => (
                          <Select.Option key={tag.value} value={tag.value}>
                            <TagPill
                              name={tag.name}
                              text={tag.text}
                              description={tag.description || undefined}
                              compact
                            />
                          </Select.Option>
                        ))
                    }}
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
  }
})
