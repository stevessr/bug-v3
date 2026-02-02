<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

import type { DiscourseCategory } from '../types'
import { createTopic, replyToTopic, searchTags } from '../actions'
import { renderBBCode } from '../bbcode'
import ProseMirrorEditor from '../ProseMirrorEditor.vue'

type ComposerMode = 'topic' | 'reply'
type EditMode = 'edit' | 'preview' | 'split'

const props = defineProps<{
  mode: ComposerMode
  baseUrl: string
  topicId?: number
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
const tagOptions = ref<Array<{ value: string; label: string }>>([])
const tagsLoading = ref(false)
const categoryId = ref<number | null>(props.defaultCategoryId ?? null)
const editMode = ref<EditMode>('edit')
const inputFormat = ref<'markdown' | 'bbcode'>('bbcode')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
let tagSearchTimer: number | null = null

watch(
  () => props.defaultCategoryId,
  value => {
    if (value) categoryId.value = value
  }
)

const showEditor = computed(() => editMode.value !== 'preview')
const showPreview = computed(() => editMode.value !== 'edit')

const getImageUrl = (url?: string | null) => {
  if (!url) return ''
  return url.startsWith('http') ? url : `${props.baseUrl}${url}`
}

const getIconHref = (icon?: string | null) => {
  if (!icon) return ''
  return `#${icon}`
}

const categoryTreeData = computed(() => {
  const list = props.categories ? [...props.categories] : []
  if (props.currentCategory && !list.find(cat => cat.id === props.currentCategory!.id)) {
    list.unshift(props.currentCategory)
  }

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
  if (inputFormat.value === 'bbcode') {
    return renderBBCodeWithMath(raw.value)
  } else {
    return renderMarkdown(raw.value)
  }
})

function renderBBCodeWithMath(input: string) {
  if (!input) return ''

  // Parse math blocks
  const mathBlocks: Array<{ tex: string; display: boolean }> = []
  let source = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
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
  const blocks: Array<{ tex: string; display: boolean }> = []
  let source = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
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
    } else {
      result = await replyToTopic(props.baseUrl, {
        topicId: props.topicId!,
        raw: raw.value.trim(),
        replyToPostNumber: props.replyToPostNumber
      })
    }
    raw.value = ''
    successMessage.value = '发布成功'
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
      label: item.text || item.name
    }))
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
        <template v-else>
          回复
          <span v-if="replyToPostNumber" class="text-xs text-gray-500 ml-1">
            #{{ replyToPostNumber }}
            <span v-if="replyToUsername">(@{{ replyToUsername }})</span>
          </span>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <a-select v-model:value="inputFormat" size="small" style="width: 100px">
          <a-select-option value="bbcode">BBCode</a-select-option>
          <a-select-option value="markdown">Markdown</a-select-option>
        </a-select>
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
          mode="tags"
          show-search
          :filter-option="false"
          :not-found-content="tagsLoading ? '加载中...' : '无结果'"
          placeholder="标签 (搜索或输入)"
          :token-separators="[' ', ',']"
          @search="handleTagSearch"
          @dropdownVisibleChange="handleTagDropdown"
        >
          <a-select-option v-for="tag in tagOptions" :key="tag.value" :value="tag.value">
            {{ tag.label }}
          </a-select-option>
        </a-select>
      </div>
    </div>

    <div
      class="composer-body px-4 py-4 grid gap-4"
      :class="showPreview && showEditor ? 'md:grid-cols-2' : 'grid-cols-1'"
    >
      <div v-if="showEditor" class="space-y-2">
        <!-- ProseMirror Editor -->
        <ProseMirrorEditor v-model="raw" :inputFormat="inputFormat" />
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
      <div v-if="errorMessage" class="text-sm text-red-500">{{ errorMessage }}</div>
      <div v-if="successMessage" class="text-sm text-green-600">{{ successMessage }}</div>
      <div class="flex items-center justify-end gap-2">
        <a-button :loading="isSubmitting" type="primary" @click="handleSubmit">
          {{ mode === 'topic' ? '发布' : '回复' }}
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/Composer.css"></style>
