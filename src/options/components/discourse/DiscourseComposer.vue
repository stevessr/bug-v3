<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

import type { DiscourseCategory } from './types'
import { createTopic, replyToTopic } from './actions'

type ComposerMode = 'topic' | 'reply'

const props = defineProps<{
  mode: ComposerMode
  baseUrl: string
  topicId?: number
  replyToPostNumber?: number | null
  replyToUsername?: string | null
  categories?: DiscourseCategory[]
  defaultCategoryId?: number | null
}>()

const emit = defineEmits<{
  (e: 'posted', payload: any): void
  (e: 'clearReply'): void
}>()

marked.setOptions({ breaks: true, gfm: true })

const title = ref('')
const raw = ref('')
const tagsInput = ref('')
const categoryId = ref<number | null>(props.defaultCategoryId ?? null)
const viewMode = ref<'edit' | 'preview' | 'split'>('edit')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

watch(
  () => props.defaultCategoryId,
  value => {
    if (value) categoryId.value = value
  }
)

const tags = computed(() =>
  tagsInput.value
    .split(/[,\\s]+/)
    .map(v => v.trim())
    .filter(Boolean)
)

const previewHtml = computed(() => renderMarkdown(raw.value))

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

function handleEditorKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const el = event.target as HTMLTextAreaElement | null
  if (!el) return

  const key = event.key
  const start = el.selectionStart
  const end = el.selectionEnd

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
        tags: tags.value
      })
      title.value = ''
      tagsInput.value = ''
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
        <a-select v-model:value="categoryId" placeholder="选择分类" allow-clear>
          <a-select-option v-for="cat in categories || []" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </a-select-option>
        </a-select>
        <a-input v-model:value="tagsInput" placeholder="标签 (逗号或空格分隔)" />
      </div>
    </div>

    <div
      class="composer-body px-4 py-4 grid gap-4"
      :class="showPreview && showEditor ? 'md:grid-cols-2' : 'grid-cols-1'"
    >
      <div v-if="showEditor" class="space-y-2">
        <a-textarea
          v-model:value="raw"
          :rows="10"
          placeholder="支持 Markdown 与 LaTeX（$...$ / $$...$$）"
          @keydown="handleEditorKeydown"
        />
        <div class="text-xs text-gray-500">输入 ` 或 $ 会自动补全成对符号</div>
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

<style scoped>
@import 'katex/dist/katex.min.css';

.composer :deep(textarea) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.preview-content :deep(pre) {
  background: #111827;
  color: #e5e7eb;
  padding: 0.75rem;
  border-radius: 6px;
  overflow-x: auto;
}

.preview-content :deep(code) {
  background: #1f2937;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
}
</style>
