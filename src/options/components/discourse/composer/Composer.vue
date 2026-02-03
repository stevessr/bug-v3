<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

import type { DiscourseCategory } from '../types'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'
import { createTopic, replyToTopic, editPost, searchTags } from '../actions'
import { parseEmojiShortcodeToBBCode, parseEmojiShortcodeToMarkdown, renderBBCode } from '../bbcode'
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'
import TagPill from '../layout/TagPill.vue'
import ProseMirrorEditor from '../ProseMirrorEditor'

type ComposerMode = 'topic' | 'reply' | 'edit'
type EditMode = 'edit' | 'preview' | 'split'

const props = defineProps<{
  mode: ComposerMode
  baseUrl: string
  topicId?: number
  postId?: number
  initialRaw?: string | null
  originalRaw?: string | null
  replyToPostNumber?: number | null
  replyToUsername?: string | null
  categories?: DiscourseCategory[]
  currentCategory?: DiscourseCategory | null
  defaultCategoryId?: number | null
}>()

const emit = defineEmits<{
  (e: 'posted', payload: any): void
  (e: 'clearReply'): void
}>()

marked.setOptions({ breaks: true, gfm: true })

const title = ref('')
const raw = ref('')
const selectedTags = ref<string[]>([])
const tagOptions = ref<Array<{ value: string; label: string; description?: string | null }>>([])
const tagsLoading = ref(false)
const categoryId = ref<number | null>(props.defaultCategoryId ?? null)
const editMode = ref<EditMode>('edit')
const editReason = ref('')
const inputFormat = ref<'markdown' | 'bbcode'>('markdown')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
let tagSearchTimer: number | null = null
const preloadedCategoriesReadyToken = ref(0)
const emojiReadyToken = ref(0)

watch(
  () => props.defaultCategoryId,
  value => {
    if (value) categoryId.value = value
  }
)

watch(
  () => [props.mode, props.postId, props.initialRaw] as const,
  ([mode, postId, initialRaw]) => {
    if (mode === 'edit') {
      raw.value = initialRaw || ''
      editReason.value = ''
    } else if (mode === 'reply') {
      raw.value = ''
    }
  },
  { immediate: true }
)

watch(
  () => props.baseUrl,
  async value => {
    if (!isLinuxDoUrl(value)) return
    await ensurePreloadedCategoriesLoaded()
    preloadedCategoriesReadyToken.value++
    await ensureEmojiShortcodesLoaded(value)
    emojiReadyToken.value++
  },
  { immediate: true }
)

const showEditor = computed(() => editMode.value !== 'preview')
const showPreview = computed(() => editMode.value !== 'edit')
const previewFormat = computed(() => {
  const value = raw.value || ''
  if (detectHtmlAst(value)) return 'html'
  if (detectBbcodeAst(value)) return 'bbcode'
  return 'markdown'
})

const getImageUrl = (url?: string | null) => {
  if (!url) return ''
  return url.startsWith('http') ? url : `${props.baseUrl}${url}`
}

const getIconHref = (icon?: string | null) => {
  if (!icon) return ''
  return `#${icon}`
}

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

const categoryTreeData = computed(() => {
  const list = mergedCategories.value

  const nodeMap = new Map<number, { title: string; value: number; key: number; children: any[] }>()
  const childrenByParent = new Map<number, Set<number>>()

  const linkChild = (parentId: number, childId: number) => {
    const children = childrenByParent.get(parentId) || new Set<number>()
    children.add(childId)
    childrenByParent.set(parentId, children)
  }

  list.forEach(cat => {
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

  // Prefer explicit parent links.
  list.forEach(cat => {
    if (cat.parent_category_id && nodeMap.has(cat.parent_category_id)) {
      linkChild(cat.parent_category_id, cat.id)
    }
  })

  // Fallback: infer hierarchy from parent subcategory_ids.
  list.forEach(cat => {
    if (!cat.subcategory_ids?.length) return
    cat.subcategory_ids.forEach(childId => {
      if (nodeMap.has(childId)) {
        linkChild(cat.id, childId)
      }
    })
  })

  const hasParent = new Set<number>()
  childrenByParent.forEach((childIds, parentId) => {
    const parent = nodeMap.get(parentId)
    if (!parent) return
    childIds.forEach(childId => {
      const child = nodeMap.get(childId)
      if (!child) return
      if (!parent.children.some(item => item.value === child.value)) {
        parent.children.push(child)
      }
      hasParent.add(childId)
    })
  })

  const roots: Array<{ title: string; value: number; key: number; children: any[] }> = []
  nodeMap.forEach((node, id) => {
    if (!hasParent.has(id)) {
      roots.push(node)
    }
  })

  return roots
})

const normalizeTreeNode = (node: any) => {
  return node?.dataRef ?? node
}

const previewHtml = computed(() => {
  emojiReadyToken.value
  if (previewFormat.value === 'bbcode') {
    return renderBBCodeWithMath(raw.value)
  } else if (previewFormat.value === 'html') {
    return renderHtml(raw.value)
  } else {
    return renderMarkdown(raw.value)
  }
})

function renderBBCodeWithMath(input: string) {
  if (!input) return ''

  const withEmoji = parseEmojiShortcodeToBBCode(input)

  // Parse math blocks
  const mathBlocks: Array<{ tex: string; display: boolean }> = []
  let source = withEmoji.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const id = mathBlocks.length
    mathBlocks.push({ tex, display: true })
    return `@@MATH_BLOCK_${id}@@`
  })
  source = source.replace(/(^|[^\\])\$(.+?)\$/g, (_match, prefix, tex) => {
    const id = mathBlocks.length
    mathBlocks.push({ tex, display: false })
    return `${prefix}@@MATH_INLINE_${id}@@`
  })

  // Render BBCode
  let html = renderBBCode(source)

  // Replace math placeholders with rendered LaTeX
  html = html.replace(/@@MATH_(BLOCK|INLINE)_(\d+)@@/g, (_match, kind, index) => {
    const item = mathBlocks[Number(index)]
    if (!item) return ''
    return katex.renderToString(item.tex, {
      displayMode: kind === 'BLOCK',
      throwOnError: false
    })
  })

  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      'math',
      'semantics',
      'mrow',
      'mi',
      'mn',
      'mo',
      'annotation',
      'annotation-xml',
      'svg',
      'path',
      'img'
    ],
    ADD_ATTR: ['class', 'style', 'src', 'alt', 'viewBox']
  })
}

function renderMarkdown(input: string) {
  if (!input) return ''
  const withEmoji = parseEmojiShortcodeToMarkdown(input)
  const blocks: Array<{ tex: string; display: boolean }> = []
  let source = withEmoji.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const id = blocks.length
    blocks.push({ tex, display: true })
    return `@@MATH_BLOCK_${id}@@`
  })
  source = source.replace(/(^|[^\\])\$(.+?)\$/g, (_match, prefix, tex) => {
    const id = blocks.length
    blocks.push({ tex, display: false })
    return `${prefix}@@MATH_INLINE_${id}@@`
  })
  let html = marked.parse(source) as string
  html = html.replace(/@@MATH_(BLOCK|INLINE)_(\d+)@@/g, (_match, kind, index) => {
    const item = blocks[Number(index)]
    if (!item) return ''
    return katex.renderToString(item.tex, {
      displayMode: kind === 'BLOCK',
      throwOnError: false
    })
  })
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      'math',
      'semantics',
      'mrow',
      'mi',
      'mn',
      'mo',
      'annotation',
      'annotation-xml',
      'svg',
      'path',
      'img'
    ],
    ADD_ATTR: ['class', 'style', 'src', 'alt', 'viewBox']
  })
}



function renderHtml(input: string) {
  if (!input) return ''
  return DOMPurify.sanitize(input, {
    ADD_TAGS: [
      'math',
      'semantics',
      'mrow',
      'mi',
      'mn',
      'mo',
      'annotation',
      'annotation-xml',
      'svg',
      'path',
      'img'
    ],
    ADD_ATTR: ['class', 'style', 'src', 'alt', 'viewBox']
  })
}

function detectHtmlAst(input: string) {
  if (!input || !input.includes('<')) return false
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(input, 'text/html')
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
    while (walker.nextNode()) {
      const el = walker.currentNode
      const tag = (el as Element).tagName.toLowerCase()
      if (tag !== 'br') return true
    }
  } catch {
    return false
  }
  return false
}

function detectBbcodeAst(input: string) {
  if (!input || !input.includes('[')) return false
  const allowed = new Set([
    'b',
    'i',
    'u',
    's',
    'img',
    'url',
    'quote',
    'code',
    'list',
    'spoiler',
    'size',
    'color',
    'center',
    'left',
    'right',
    'sub',
    'sup'
  ])
  const stack: string[] = []
  const regex = /\[\/?([a-z0-9]+)(?:=[^\]]+)?\]/gi
  let match: RegExpExecArray | null
  let found = false
  while ((match = regex.exec(input))) {
    const rawTag = match[1]?.toLowerCase()
    if (!rawTag || !allowed.has(rawTag)) continue
    found = true
    const isClosing = match[0].startsWith('[/')
    if (isClosing) {
      if (stack.length && stack[stack.length - 1] === rawTag) {
        stack.pop()
      }
    } else {
      stack.push(rawTag)
    }
  }
  return found
}
async function handleSubmit() {
  if (!raw.value.trim()) {
    errorMessage.value = '请输入内容'
    return
  }
  if (props.mode === 'topic' && !title.value.trim()) {
    errorMessage.value = '请输入标题'
    return
  }
  if (props.mode === 'reply' && !props.topicId) {
    errorMessage.value = '缺少话题 ID'
    return
  }
  if (props.mode === 'edit' && !props.postId) {
    errorMessage.value = '缺少帖子 ID'
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true
  try {
    let result: any = null
    if (props.mode === 'topic') {
      result = await createTopic(props.baseUrl, {
        title: title.value.trim(),
        raw: raw.value.trim(),
        categoryId: categoryId.value,
        tags: selectedTags.value
      })
      title.value = ''
      selectedTags.value = []
    } else if (props.mode === 'reply') {
      result = await replyToTopic(props.baseUrl, {
        topicId: props.topicId!,
        raw: raw.value.trim(),
        replyToPostNumber: props.replyToPostNumber
      })
    } else {
      result = await editPost(props.baseUrl, {
        postId: props.postId!,
        raw: raw.value.trim(),
        editReason: editReason.value || undefined,
        topicId: props.topicId,
        originalText: props.originalRaw ?? props.initialRaw ?? raw.value.trim(),
        locale: ''
      })
    }
    raw.value = ''
    successMessage.value = props.mode === 'edit' ? '编辑成功' : '发布成功'
    emit('posted', result)
  } catch (error) {
    errorMessage.value = (error as Error).message || '请求失败'
  } finally {
    isSubmitting.value = false
  }
}

async function runTagSearch(query: string) {
  tagsLoading.value = true
  try {
    const results = await searchTags(props.baseUrl, query, categoryId.value)
    tagOptions.value = results.map(item => ({
      value: item.name || item.text,
      label: item.text || item.name,
      description: item.description || null
    }))
  } catch {
    tagOptions.value = []
  } finally {
    tagsLoading.value = false
  }
}

const getTagOption = (value: string) => {
  return tagOptions.value.find(option => option.value === value) || null
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

watch(categoryId, () => {
  tagOptions.value = []
  if (selectedTags.value.length === 0) {
    runTagSearch('')
  }
})
</script>

<template>
  <div class="composer border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-900">
    <div
      class="composer-header flex items-center justify-between px-4 py-3 border-b dark:border-gray-700"
    >
      <div class="text-sm font-medium dark:text-white">
        <template v-if="mode === 'topic'">发帖子</template>
        <template v-else-if="mode === 'edit'">编辑帖子</template>
        <template v-else>
          回复
          <span v-if="replyToPostNumber" class="text-xs text-gray-500 ml-1">
            #{{ replyToPostNumber }}
            <span v-if="replyToUsername">(@{{ replyToUsername }})</span>
          </span>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <a-button
          size="small"
          type="text"
          :class="{ 'text-blue-500': editMode === 'edit' }"
          @click="editMode = 'edit'"
        >
          编辑
        </a-button>
        <a-button
          size="small"
          type="text"
          :class="{ 'text-blue-500': editMode === 'split' }"
          @click="editMode = 'split'"
        >
          分屏
        </a-button>
        <a-button
          size="small"
          type="text"
          :class="{ 'text-blue-500': editMode === 'preview' }"
          @click="editMode = 'preview'"
        >
          预览
        </a-button>
        <a-button
          v-if="mode === 'reply' && replyToPostNumber"
          size="small"
          @click="emit('clearReply')"
        >
          取消引用
        </a-button>
      </div>
    </div>

    <div v-if="mode === 'topic'" class="px-4 pt-4 space-y-3">
      <a-input v-model:value="title" placeholder="标题" />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a-tree-select
          v-model:value="categoryId"
          placeholder="选择分类"
          allow-clear
          show-search
          tree-default-expand-all
          tree-node-filter-prop="title"
          :tree-data="categoryTreeData"
        >
          <template #title="node">
            <span v-if="normalizeTreeNode(node)?.title" class="category-option">
              <span
                class="category-option-icon"
                :style="{ color: `#${normalizeTreeNode(node)?.color || '94a3b8'}` }"
              >
                <img
                  v-if="normalizeTreeNode(node)?.logoUrl"
                  :src="getImageUrl(normalizeTreeNode(node)?.logoUrl)"
                  :alt="normalizeTreeNode(node)?.title"
                  class="category-option-img"
                />
                <span v-else-if="normalizeTreeNode(node)?.emoji" class="category-option-emoji">
                  {{ normalizeTreeNode(node)?.emoji }}
                </span>
                <svg
                  v-else-if="normalizeTreeNode(node)?.icon"
                  class="category-option-svg"
                  viewBox="0 0 24 24"
                >
                  <use :href="getIconHref(normalizeTreeNode(node)?.icon)" />
                </svg>
                <span
                  v-else
                  class="category-option-dot"
                  :style="{ backgroundColor: `#${normalizeTreeNode(node)?.color || '94a3b8'}` }"
                />
              </span>
              <span>{{ normalizeTreeNode(node)?.title }}</span>
            </span>
            <span v-else>{{ normalizeTreeNode(node)?.title || normalizeTreeNode(node) }}</span>
          </template>
        </a-tree-select>
        <a-select
          v-model:value="selectedTags"
          mode="multiple"
          show-search
          :filter-option="false"
          :not-found-content="tagsLoading ? '加载中...' : '无结果'"
          placeholder="标签 (搜索或输入)"
          @search="handleTagSearch"
          @dropdownVisibleChange="handleTagDropdown"
        >
          <template #tagRender="{ value, closable, onClose }">
            <span class="inline-flex items-center gap-1 mr-1">
              <TagPill
                :name="String(value)"
                :text="getTagOption(String(value))?.label || String(value)"
                :description="getTagOption(String(value))?.description || null"
                compact
              />
              <button
                v-if="closable"
                type="button"
                class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                @mousedown.prevent
                @click="onClose"
              >
                ×
              </button>
            </span>
          </template>
          <a-select-option v-for="tag in tagOptions" :key="tag.value" :value="tag.value">
            <TagPill
              :name="tag.value"
              :text="tag.label"
              :description="tag.description || null"
              compact
            />
          </a-select-option>
        </a-select>
      </div>
    </div>

    <div
      class="composer-body px-4 py-4 grid gap-4"
      :class="showPreview && showEditor ? 'md:grid-cols-2' : 'grid-cols-1'"
    >
      <div v-if="showEditor" class="composer-editor space-y-2">
        <!-- ProseMirror Editor -->
        <ProseMirrorEditor
          v-model="raw"
          :inputFormat="inputFormat"
          :baseUrl="props.baseUrl"
          class="composer-editor-input"
        />
        <div class="text-xs text-gray-500">
          <template v-if="inputFormat === 'bbcode'">
            BBCode: [b] 粗体 [/b] [i] 斜体 [/i] [u] 下划线 [/u] [url=链接] 文字 [/url] [img]
            图片地址 [/img] [quote] 引用 [/quote] [spoiler] 剧透模糊 [/spoiler]
          </template>
          <template v-else>
            Markdown: **粗体** *斜体* ~~删除~~ `代码` [链接](url) ![图片](url)
          </template>
          · LaTeX: $...$ 行内 / $$...$$ 块级
        </div>
      </div>

      <div
        v-if="showPreview"
        class="preview border rounded-md dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800"
      >
        <div class="text-xs text-gray-400 mb-2">预览</div>
        <div
          class="preview-content prose dark:prose-invert max-w-none text-sm"
          v-html="previewHtml"
        />
      </div>
    </div>

    <div class="composer-footer px-4 pb-4 space-y-2">
      <a-input
        v-if="mode === 'edit'"
        v-model:value="editReason"
        placeholder="编辑原因（可选）"
      />
      <div v-if="errorMessage" class="text-sm text-red-500">{{ errorMessage }}</div>
      <div v-if="successMessage" class="text-sm text-green-600">{{ successMessage }}</div>
      <div class="flex items-center justify-end gap-2">
        <a-button :loading="isSubmitting" type="primary" @click="handleSubmit">
          {{ mode === 'topic' ? '发布' : mode === 'edit' ? '保存' : '回复' }}
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/Composer.css"></style>
