<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

import type { DiscourseCategory } from '../types'
import { createTopic, replyToTopic, searchTags } from '../actions'
import { renderBBCode, showColorPickerAtButton } from '../bbcode'

type ComposerMode = 'topic' | 'reply'

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
const viewMode = ref<'edit' | 'preview' | 'split'>('edit')
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

  const roots: Array<{ title: string; value: number; key: number; children: any[] }> = []
  list.forEach(cat => {
    const node = nodeMap.get(cat.id)!
    if (cat.parent_category_id && nodeMap.has(cat.parent_category_id)) {
      nodeMap.get(cat.parent_category_id)!.children.push(node)
    } else {
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

  // First, parse math blocks
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

  return html
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
      'path'
    ],
    ADD_ATTR: ['class', 'style']
  })
}

function insertAround(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  selectionStart: number,
  selectionEnd: number
) {
  const value = el.value
  const selected = value.slice(selectionStart, selectionEnd)
  const nextValue =
    value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
  el.value = nextValue
  raw.value = nextValue
  const cursor = selectionStart + before.length + selected.length
  requestAnimationFrame(() => {
    el.setSelectionRange(cursor, cursor)
  })
}

// BBCode toolbar functions
function insertBBCode(tag: string, attribute?: string) {
  const textarea = document.querySelector('.composer textarea') as HTMLTextAreaElement
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end)

  let before = ''
  let after = ''

  if (attribute) {
    before = `[${tag}=${attribute}]`
  } else {
    before = `[${tag}]`
  }
  after = `[/${tag}]`

  insertAround(textarea, before, after, start, end)
  textarea.focus()
}

function insertUrl() {
  const textarea = document.querySelector('.composer textarea') as HTMLTextAreaElement
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end)

  if (selected) {
    // Text is selected, use it as the link text
    const url = prompt('请输入链接地址：', 'https://')
    if (url) {
      insertAround(textarea, `[url=${url}]`, '[/url]', start, end)
    }
  } else {
    // No text selected, prompt for both URL and text
    const url = prompt('请输入链接地址：', 'https://')
    if (url) {
      const text = prompt('请输入链接文本：', url)
      insertAround(textarea, `[url=${url}]${text || url}`, '[/url]', start, end)
    }
  }
  textarea.focus()
}

function insertImage() {
  const textarea = document.querySelector('.composer textarea') as HTMLTextAreaElement
  if (!textarea) return

  const url = prompt('请输入图片地址：', 'https://')
  if (url) {
    const start = textarea.selectionStart
    insertAround(textarea, `[img]${url}[/img]`, '', start, start)
  }
  textarea.focus()
}

function insertColor() {
  const textarea = document.querySelector('.composer textarea') as HTMLTextAreaElement
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd

  showColorPickerAtButton(
    '.bbcode-toolbar button[title="颜色"]',
    (color: string) => {
      insertAround(textarea, `[color=${color}]`, '[/color]', start, end)
      textarea.focus()
    },
    () => {
      textarea.focus()
    },
    '#ff0000'
  )
}

function insertSize() {
  const textarea = document.querySelector('.composer textarea') as HTMLTextAreaElement
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd

  const size = prompt('请输入字体大小 (像素):', '16')
  if (size) {
    insertAround(textarea, `[size=${size}]`, '[/size]', start, end)
  }
  textarea.focus()
}

function insertSpoiler() {
  const textarea = document.querySelector('.composer textarea') as HTMLTextAreaElement
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd

  insertAround(textarea, '[spoiler]', '[/spoiler]', start, end)
  textarea.focus()
}

function handleEditorKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const el = event.target as HTMLTextAreaElement | null
  if (!el) return

  const key = event.key
  const start = el.selectionStart
  const end = el.selectionEnd

  if (inputFormat.value === 'bbcode') {
    // BBCode shortcuts
    if (start !== end) {
      if (key === 'b') {
        event.preventDefault()
        insertAround(el, '[b]', '[/b]', start, end)
      } else if (key === 'i') {
        event.preventDefault()
        insertAround(el, '[i]', '[/i]', start, end)
      } else if (key === 'u') {
        event.preventDefault()
        insertAround(el, '[u]', '[/u]', start, end)
      } else if (key === 'q') {
        event.preventDefault()
        insertAround(el, '[quote]', '[/quote]', start, end)
      }
    }

    if (key === '$') {
      event.preventDefault()
      insertAround(el, key, key, start, end)
    }
  } else {
    // Markdown shortcuts
    if ((key === '*' || key === '_' || key === '~') && start !== end) {
      event.preventDefault()
      insertAround(el, key, key, start, end)
      return
    }

    if (key === '`' || key === '$') {
      event.preventDefault()
      insertAround(el, key, key, start, end)
    }
  }
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

const showPreview = computed(() => viewMode.value !== 'edit')
const showEditor = computed(() => viewMode.value !== 'preview')
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
        <!-- Format switcher -->
        <a-select v-model:value="inputFormat" size="small" style="width: 100px">
          <a-select-option value="bbcode">BBCode</a-select-option>
          <a-select-option value="markdown">Markdown</a-select-option>
        </a-select>
        <a-button
          size="small"
          type="text"
          :class="{ 'text-blue-500': viewMode === 'edit' }"
          @click="viewMode = 'edit'"
        >
          编辑
        </a-button>
        <a-button
          size="small"
          type="text"
          :class="{ 'text-blue-500': viewMode === 'split' }"
          @click="viewMode = 'split'"
        >
          分屏
        </a-button>
        <a-button
          size="small"
          type="text"
          :class="{ 'text-blue-500': viewMode === 'preview' }"
          @click="viewMode = 'preview'"
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
        <!-- BBCode Toolbar -->
        <div
          v-if="inputFormat === 'bbcode'"
          class="bbcode-toolbar flex flex-wrap gap-1 p-2 border rounded dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        >
          <a-button size="small" @click="insertBBCode('b')" title="粗体"><b>B</b></a-button>
          <a-button size="small" @click="insertBBCode('i')" title="斜体"><i>I</i></a-button>
          <a-button size="small" @click="insertBBCode('u')" title="下划线"><u>U</u></a-button>
          <a-button size="small" @click="insertBBCode('s')" title="删除线"><s>S</s></a-button>
          <div class="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
          <a-button size="small" @click="insertUrl" title="链接">🔗</a-button>
          <a-button size="small" @click="insertImage" title="图片">🖼️</a-button>
          <a-button size="small" @click="insertBBCode('quote')" title="引用">❝</a-button>
          <a-button size="small" @click="insertSpoiler()" title="剧透模糊">👁️</a-button>
          <a-button size="small" @click="insertBBCode('code')" title="代码">💻</a-button>
          <a-button size="small" @click="insertBBCode('list')" title="列表">📝</a-button>
          <div class="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
          <a-button size="small" @click="insertColor" title="颜色">🎨</a-button>
          <a-button size="small" @click="insertSize" title="大小">📏</a-button>
        </div>

        <a-textarea
          v-model:value="raw"
          :rows="10"
          :placeholder="
            inputFormat === 'bbcode'
              ? '支持 BBCode 与 LaTeX（$...$ / $$...$$）'
              : '支持 Markdown 与 LaTeX（$...$ / $$...$$）'
          "
          @keydown="handleEditorKeydown"
        />
        <div class="text-xs text-gray-500">
          <template v-if="inputFormat === 'bbcode'">
            BBCode: [b] 粗体 [/b] [i] 斜体 [/i] [u] 下划线 [/u] [url=链接] 文字 [/url] [img] 图片地址 [/img]
            [quote] 引用 [/quote] [spoiler] 剧透模糊 [/spoiler]
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
