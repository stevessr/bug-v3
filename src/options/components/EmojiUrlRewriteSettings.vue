<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'

import { useEmojiStore } from '@/stores'
import {
  buildEmojiUrlRewriteRegex,
  rewriteEmojiUrlFields,
  rewriteEmojiUrlValue,
  type EmojiUrlRewriteField
} from '@/utils/emojiUrlRewrite'
import CachedImage from '@/components/CachedImage.vue'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'

type PreviewExample = {
  emojiId: string
  emojiName: string
  emojiUrl: string
  groupName: string
  before: string
  after: string
  changedFields: EmojiUrlRewriteField[]
}

type PreviewGroupSummary = {
  groupId: string
  groupName: string
  groupIcon: string
  groupIconAfter?: string
  groupIconChanged: boolean
  updatedEmojiCount: number
  updatedFieldCount: number
}

type PreviewStateStatus = 'idle' | 'dirty' | 'computing' | 'ready' | 'error'

type PreviewState = {
  status: PreviewStateStatus
  updatedEmojiCount: number
  updatedFieldCount: number
  touchedGroupCount: number
  groupSummaries: PreviewGroupSummary[]
  generatedAt: number | null
  error: string
}

const PREVIEW_GROUP_BATCH_SIZE = 20
const PREVIEW_SCAN_GROUP_CHUNK = 8
const PREVIEW_EXAMPLE_LIMIT_PER_GROUP = 6
const PREVIEW_DEBOUNCE_MS = 300

const emojiStore = useEmojiStore()

const pattern = ref('')
const flags = ref('g')
const replacement = ref('')
const exampleUrl = ref('')
const livePreviewEnabled = ref(false)
const isApplying = ref(false)
const lastResult = ref<{
  updatedEmojiCount: number
  updatedFieldCount: number
  touchedGroupCount: number
  appliedAt: number
} | null>(null)

const previewState = ref<PreviewState>(createEmptyPreviewState())
const visibleGroupCount = ref(PREVIEW_GROUP_BATCH_SIZE)
const expandedGroupIds = ref<string[]>([])
const groupExamples = ref<Record<string, PreviewExample[]>>({})
const groupExamplesLoading = ref<Record<string, boolean>>({})

let previewTimer: ReturnType<typeof setTimeout> | null = null
let previewRunToken = 0

function createEmptyPreviewState(status: PreviewStateStatus = 'idle', error = ''): PreviewState {
  return {
    status,
    updatedEmojiCount: 0,
    updatedFieldCount: 0,
    touchedGroupCount: 0,
    groupSummaries: [],
    generatedAt: null,
    error
  }
}

function clearScheduledPreview() {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
}

function resetGroupDisplayState() {
  visibleGroupCount.value = PREVIEW_GROUP_BATCH_SIZE
  expandedGroupIds.value = []
  groupExamples.value = {}
  groupExamplesLoading.value = {}
}

function setPreviewState(state: PreviewState) {
  previewState.value = state
}

function invalidatePreview(status: PreviewStateStatus = 'dirty') {
  clearScheduledPreview()
  previewRunToken++
  resetGroupDisplayState()
  setPreviewState(createEmptyPreviewState(status))
}

function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, 0)
  })
}

const totalEmojiCount = computed(() =>
  emojiStore.groups.reduce((count, group) => count + (group.emojis?.length || 0), 0)
)

const regexState = computed(() => {
  if (!pattern.value.trim()) {
    return {
      regex: null as RegExp | null,
      error: '',
      isReady: false
    }
  }

  try {
    return {
      regex: buildEmojiUrlRewriteRegex(pattern.value, flags.value),
      error: '',
      isReady: true
    }
  } catch (error) {
    return {
      regex: null as RegExp | null,
      error: error instanceof Error ? error.message : '正则表达式无效',
      isReady: false
    }
  }
})

const examplePreview = computed(() => {
  const regex = regexState.value.regex
  const source = exampleUrl.value.trim()
  if (!regex || !source) return ''
  return rewriteEmojiUrlValue(source, regex, replacement.value)
})

const exampleChanged = computed(() => {
  const source = exampleUrl.value.trim()
  return !!source && examplePreview.value !== source
})

const previewStatusText = computed(() => {
  switch (previewState.value.status) {
    case 'computing':
      return '正在分批扫描表情 URL...'
    case 'dirty':
      return '规则已变更，请刷新预览'
    case 'ready':
      return previewState.value.generatedAt
        ? `预览生成于 ${new Date(previewState.value.generatedAt).toLocaleString('zh-CN')}`
        : '预览已生成'
    case 'error':
      return previewState.value.error || '预览生成失败'
    default:
      return '尚未生成预览'
  }
})

const previewNeedsRefresh = computed(() => previewState.value.status === 'dirty')
const visibleGroupSummaries = computed(() =>
  previewState.value.groupSummaries.slice(0, visibleGroupCount.value)
)
const hasMoreGroups = computed(
  () => previewState.value.groupSummaries.length > visibleGroupCount.value
)
const canRunPreview = computed(
  () => !!regexState.value.regex && previewState.value.status !== 'computing'
)
const canApply = computed(
  () =>
    !!regexState.value.regex &&
    previewState.value.status === 'ready' &&
    previewState.value.updatedFieldCount > 0 &&
    !isApplying.value
)

const fieldLabelMap: Record<EmojiUrlRewriteField, string> = {
  url: 'url',
  displayUrl: 'displayUrl',
  originUrl: 'originUrl'
}

const formatFields = (fields: EmojiUrlRewriteField[]) => fields.map(field => fieldLabelMap[field])

function buildPreviewExample(
  emoji: {
    id: string
    name: string
    url?: string
    displayUrl?: string
    originUrl?: string
  },
  groupName: string,
  changedFields: EmojiUrlRewriteField[],
  rewrittenEmoji: {
    url?: string
    displayUrl?: string
    originUrl?: string
  }
): PreviewExample {
  const primaryField = changedFields[0]
  return {
    emojiId: emoji.id,
    emojiName: emoji.name,
    emojiUrl: emoji.displayUrl || emoji.url || '',
    groupName,
    before: String(emoji[primaryField] || ''),
    after: String(rewrittenEmoji[primaryField] || ''),
    changedFields
  }
}

async function runPreview() {
  const regex = regexState.value.regex
  if (!regex) {
    invalidatePreview(regexState.value.error ? 'error' : 'idle')
    return
  }

  clearScheduledPreview()
  resetGroupDisplayState()

  const runId = ++previewRunToken
  setPreviewState({
    ...createEmptyPreviewState('computing')
  })

  try {
    let updatedEmojiCount = 0
    let updatedFieldCount = 0
    const groupSummaries: PreviewGroupSummary[] = []

    for (let index = 0; index < emojiStore.groups.length; index++) {
      if (runId !== previewRunToken) return

      const group = emojiStore.groups[index]
      let groupUpdatedEmojiCount = 0
      let groupUpdatedFieldCount = 0
      let groupIconChanged = false
      let groupIconAfter = group.icon

      // Check group icon
      if (group.icon && regex.test(group.icon)) {
        const rewrittenIcon = group.icon.replace(regex, replacement.value)
        if (rewrittenIcon !== group.icon) {
          groupUpdatedFieldCount++
          updatedFieldCount++ // Add global count
          groupIconChanged = true
          groupIconAfter = rewrittenIcon
        }
      }

      for (const emoji of group.emojis || []) {
        if (!emoji) continue

        const rewriteResult = rewriteEmojiUrlFields(emoji, regex, replacement.value)
        if (!rewriteResult.changed) continue

        updatedEmojiCount++
        updatedFieldCount += rewriteResult.changedFields.length
        groupUpdatedEmojiCount++
        groupUpdatedFieldCount += rewriteResult.changedFields.length
      }

      if (groupUpdatedEmojiCount > 0 || groupIconChanged) {
        groupSummaries.push({
          groupId: group.id,
          groupName: group.name,
          groupIcon: group.icon || '',
          groupIconAfter: groupIconAfter,
          groupIconChanged: groupIconChanged,
          updatedEmojiCount: groupUpdatedEmojiCount,
          updatedFieldCount: groupUpdatedFieldCount
        })
      }

      if ((index + 1) % PREVIEW_SCAN_GROUP_CHUNK === 0) {
        setPreviewState({
          status: 'computing',
          updatedEmojiCount,
          updatedFieldCount,
          touchedGroupCount: groupSummaries.length,
          groupSummaries: [],
          generatedAt: null,
          error: ''
        })
        await yieldToBrowser()
      }
    }

    if (runId !== previewRunToken) return

    setPreviewState({
      status: 'ready',
      updatedEmojiCount,
      updatedFieldCount,
      touchedGroupCount: groupSummaries.length,
      groupSummaries,
      generatedAt: Date.now(),
      error: ''
    })
  } catch (error) {
    if (runId !== previewRunToken) return
    setPreviewState(
      createEmptyPreviewState('error', error instanceof Error ? error.message : '预览生成失败')
    )
  }
}

function schedulePreview() {
  if (!livePreviewEnabled.value || !regexState.value.regex) return

  clearScheduledPreview()
  previewTimer = setTimeout(() => {
    void runPreview()
  }, PREVIEW_DEBOUNCE_MS)
}

function refreshPreview() {
  if (!regexState.value.regex) {
    message.error(regexState.value.error || '请先输入有效的正则表达式')
    return
  }

  void runPreview()
}

function loadMoreGroups() {
  visibleGroupCount.value += PREVIEW_GROUP_BATCH_SIZE
}

function isGroupExpanded(groupId: string) {
  return expandedGroupIds.value.includes(groupId)
}

function setGroupExpanded(groupId: string, expanded: boolean) {
  if (expanded) {
    if (!expandedGroupIds.value.includes(groupId)) {
      expandedGroupIds.value = [...expandedGroupIds.value, groupId]
    }
    return
  }

  expandedGroupIds.value = expandedGroupIds.value.filter(id => id !== groupId)
}

async function loadGroupExamples(summary: PreviewGroupSummary) {
  const regex = regexState.value.regex
  if (!regex) return

  const group = emojiStore.groups.find(item => item.id === summary.groupId)
  if (!group) return

  groupExamplesLoading.value = {
    ...groupExamplesLoading.value,
    [summary.groupId]: true
  }

  try {
    const examples: PreviewExample[] = []

    for (const emoji of group.emojis || []) {
      if (!emoji) continue

      const rewriteResult = rewriteEmojiUrlFields(emoji, regex, replacement.value)
      if (!rewriteResult.changed) continue

      examples.push(
        buildPreviewExample(emoji, group.name, rewriteResult.changedFields, rewriteResult.emoji)
      )

      if (examples.length >= PREVIEW_EXAMPLE_LIMIT_PER_GROUP) break
    }

    groupExamples.value = {
      ...groupExamples.value,
      [summary.groupId]: examples
    }
  } finally {
    groupExamplesLoading.value = {
      ...groupExamplesLoading.value,
      [summary.groupId]: false
    }
  }
}

async function toggleGroupExamples(summary: PreviewGroupSummary) {
  if (isGroupExpanded(summary.groupId)) {
    setGroupExpanded(summary.groupId, false)
    return
  }

  if (!groupExamples.value[summary.groupId] && !groupExamplesLoading.value[summary.groupId]) {
    await loadGroupExamples(summary)
  }

  setGroupExpanded(summary.groupId, true)
}

const applyRewrite = () => {
  const regex = regexState.value.regex
  if (!regex) {
    message.error(regexState.value.error || '请先输入有效的正则表达式')
    return
  }

  if (previewState.value.status !== 'ready') {
    message.info('请先生成最新预览，再执行批量更新')
    return
  }

  if (previewState.value.updatedFieldCount === 0) {
    message.info('没有匹配到需要更新的表情 URL 或分组图标')
    return
  }

  const preview = previewState.value
  Modal.confirm({
    title: '确认批量更新表情 URL？',
    content: `将更新 ${preview.updatedEmojiCount} 个表情，涉及 ${preview.updatedFieldCount} 个 URL 字段，覆盖 ${preview.touchedGroupCount} 个分组。`,
    okText: '开始更新',
    cancelText: '取消',
    async onOk() {
      isApplying.value = true
      try {
        const result = emojiStore.rewriteEmojiUrls(regex, replacement.value)
        lastResult.value = {
          ...result,
          appliedAt: Date.now()
        }
        message.success(
          `已更新 ${result.updatedEmojiCount} 个表情，处理 ${result.updatedFieldCount} 个 URL 字段`
        )
      } finally {
        isApplying.value = false
      }
    }
  })
}

watch(
  [pattern, flags, replacement],
  () => {
    if (!regexState.value.regex) {
      invalidatePreview(regexState.value.error ? 'error' : 'idle')
      return
    }

    invalidatePreview('dirty')
    if (livePreviewEnabled.value) {
      schedulePreview()
    }
  },
  { flush: 'post' }
)

watch(
  () => emojiStore.groups,
  () => {
    if (!regexState.value.regex) return

    invalidatePreview('dirty')
    if (livePreviewEnabled.value) {
      schedulePreview()
    }
  }
)

watch(livePreviewEnabled, enabled => {
  if (enabled) {
    if (regexState.value.regex && previewState.value.status !== 'ready') {
      schedulePreview()
    }
    return
  }

  clearScheduledPreview()
  if (previewState.value.status === 'computing') {
    invalidatePreview('dirty')
  }
})

onBeforeUnmount(() => {
  clearScheduledPreview()
  previewRunToken++
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">正则更新表情 URL</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        批量重写表情的
        <code>url</code>
        ，并同步修正命中的
        <code>displayUrl</code>
        /
        <code>originUrl</code>
        ，避免显示地址和输出地址不一致。
      </p>
    </div>

    <div class="p-6 space-y-6">
      <div class="grid gap-4 md:grid-cols-[1.2fr_0.7fr]">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              正则表达式
            </label>
            <a-input v-model:value="pattern" placeholder="例如 ^https://old-cdn\\.example\\.com/" />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Flags
              </label>
              <a-input v-model:value="flags" placeholder="例如 g 或 gi" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                替换内容
              </label>
              <a-input
                v-model:value="replacement"
                placeholder="例如 https://new-cdn.example.com/"
              />
            </div>
          </div>

          <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-white">实时预览</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  仅当前页面生效，不会写入设置。关闭后只在你手动点击时扫描。
                </div>
              </div>
              <a-switch v-model:checked="livePreviewEnabled" />
            </div>
          </div>

          <p class="text-xs text-gray-500 dark:text-gray-400">
            支持 JS 正则替换语法，可使用
            <code>$1</code>
            、
            <code>$2</code>
            等捕获组。
          </p>
        </div>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              扫描概览
            </div>
            <div class="mt-2 text-2xl font-semibold dark:text-white">
              {{ previewState.updatedEmojiCount }}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{
                previewState.status === 'ready' || previewState.status === 'computing'
                  ? '当前预览命中的表情数量'
                  : '生成预览后显示命中数量'
              }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
              <div class="text-xs text-gray-500 dark:text-gray-400">字段数</div>
              <div class="text-lg font-medium dark:text-white">
                {{ previewState.updatedFieldCount }}
              </div>
            </div>
            <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
              <div class="text-xs text-gray-500 dark:text-gray-400">分组数</div>
              <div class="text-lg font-medium dark:text-white">
                {{ previewState.touchedGroupCount }}
              </div>
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            当前总表情数：{{ totalEmojiCount }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ previewStatusText }}
          </div>
          <a-button
            block
            type="default"
            :loading="previewState.status === 'computing'"
            :disabled="!canRunPreview"
            @click="refreshPreview"
          >
            {{ livePreviewEnabled ? '立即刷新预览' : '手动生成预览' }}
          </a-button>
        </div>
      </div>

      <a-alert v-if="regexState.error" :message="regexState.error" type="error" show-icon />

      <div
        class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 space-y-4"
      >
        <div>
          <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            例子 URL 预览
          </label>
          <a-input v-model:value="exampleUrl" placeholder="输入一个示例 URL，看替换后的结果" />
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">原始</div>
            <div class="break-all font-mono text-sm dark:text-gray-200 min-h-[44px]">
              {{ exampleUrl || '尚未输入例子 URL' }}
            </div>
          </div>
          <div
            class="rounded-md p-3 border"
            :class="
              exampleChanged
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
            "
          >
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">预览结果</div>
            <div class="break-all font-mono text-sm dark:text-gray-200 min-h-[44px]">
              {{ exampleUrl ? examplePreview || exampleUrl : '输入示例后，这里会显示替换结果' }}
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">命中分组</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              结果按组分批显示，点击单个分组时才懒加载组内示例。
            </p>
          </div>
          <a-button
            type="primary"
            :loading="isApplying"
            :disabled="!canApply"
            @click="applyRewrite"
          >
            执行批量更新
          </a-button>
        </div>

        <a-alert
          v-if="previewNeedsRefresh"
          type="info"
          show-icon
          message="预览已过期"
          description="规则或表情数据已经变化，请重新生成预览后再执行。"
        />

        <a-alert
          v-else-if="previewState.status === 'computing'"
          type="info"
          show-icon
          message="正在生成预览"
          :description="`已扫描到 ${previewState.updatedEmojiCount} 个命中表情，你可以等待完成或关闭实时预览。`"
        />

        <a-alert
          v-else-if="previewState.status === 'error'"
          type="error"
          show-icon
          :message="previewState.error || '预览生成失败'"
        />

        <div
          v-else-if="previewState.status !== 'ready'"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400"
        >
          {{
            regexState.isReady
              ? '点击“手动生成预览”查看命中分组。'
              : '先输入有效的正则表达式和替换内容。'
          }}
        </div>

        <div
          v-else-if="previewState.groupSummaries.length === 0"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400"
        >
          当前没有匹配到需要更新的表情 URL 或分组图标。
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="summary in visibleGroupSummaries"
            :key="summary.groupId"
            class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0"
                >
                  <CachedImage
                    v-if="isImageUrl(normalizeImageUrl(summary.groupIcon))"
                    :src="normalizeImageUrl(summary.groupIcon)"
                    class="w-full h-full object-contain"
                  />
                  <span v-else class="text-xl">{{ summary.groupIcon }}</span>
                </div>
                <div>
                  <div class="font-medium dark:text-white">{{ summary.groupName }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    命中 {{ summary.updatedEmojiCount }} 个表情，涉及
                    {{ summary.updatedFieldCount }} 个字段
                  </div>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <a-tag color="blue">{{ summary.updatedEmojiCount }} 个表情</a-tag>
                <a-tag color="cyan">{{ summary.updatedFieldCount }} 个字段</a-tag>
                <a-button
                  size="small"
                  :loading="groupExamplesLoading[summary.groupId]"
                  @click="toggleGroupExamples(summary)"
                >
                  {{ isGroupExpanded(summary.groupId) ? '收起示例' : '查看示例' }}
                </a-button>
              </div>
            </div>

            <div v-if="isGroupExpanded(summary.groupId)" class="space-y-3">
              <!-- Group Icon Change Preview -->
              <div
                v-if="summary.groupIconChanged"
                class="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-amber-600 dark:text-amber-400 font-medium">分组图标更新</span>
                    <a-tag color="orange">icon</a-tag>
                  </div>
                </div>
                <div class="grid gap-3 md:grid-cols-2">
                  <div class="rounded-md bg-white dark:bg-gray-800 p-3 border dark:border-gray-700">
                    <div
                      class="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2"
                    >
                      修改前
                      <div
                        class="w-6 h-6 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded overflow-hidden"
                      >
                        <CachedImage
                          v-if="isImageUrl(normalizeImageUrl(summary.groupIcon))"
                          :src="normalizeImageUrl(summary.groupIcon)"
                          class="w-full h-full object-contain"
                        />
                        <span v-else class="text-xs">{{ summary.groupIcon }}</span>
                      </div>
                    </div>
                    <div class="break-all font-mono text-xs dark:text-gray-200">
                      {{ summary.groupIcon }}
                    </div>
                  </div>
                  <div
                    class="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3"
                  >
                    <div
                      class="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2"
                    >
                      修改后
                      <div
                        class="w-6 h-6 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded overflow-hidden"
                      >
                        <CachedImage
                          v-if="isImageUrl(normalizeImageUrl(summary.groupIconAfter))"
                          :src="normalizeImageUrl(summary.groupIconAfter)"
                          class="w-full h-full object-contain"
                        />
                        <span v-else class="text-xs">{{ summary.groupIconAfter }}</span>
                      </div>
                    </div>
                    <div class="break-all font-mono text-xs dark:text-gray-200">
                      {{ summary.groupIconAfter }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="
                  (groupExamples[summary.groupId] || []).length === 0 && !summary.groupIconChanged
                "
                class="rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-500 dark:text-gray-400"
              >
                当前分组没有可展示的示例，或示例仍在加载中。
              </div>

              <div
                v-for="item in groupExamples[summary.groupId] || []"
                :key="item.emojiId"
                class="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0"
                    >
                      <CachedImage
                        v-if="isImageUrl(normalizeImageUrl(item.emojiUrl))"
                        :src="normalizeImageUrl(item.emojiUrl)"
                        class="w-full h-full object-contain"
                      />
                      <span v-else class="text-xs">?</span>
                    </div>
                    <div class="font-medium dark:text-white">{{ item.emojiName }}</div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <a-tag
                      v-for="field in formatFields(item.changedFields)"
                      :key="field"
                      color="blue"
                    >
                      {{ field }}
                    </a-tag>
                  </div>
                </div>
                <div class="grid gap-3 md:grid-cols-2">
                  <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">修改前</div>
                    <div class="break-all font-mono text-xs dark:text-gray-200">
                      {{ item.before }}
                    </div>
                  </div>
                  <div
                    class="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3"
                  >
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">修改后</div>
                    <div class="break-all font-mono text-xs dark:text-gray-200">
                      {{ item.after }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              已显示 {{ visibleGroupSummaries.length }} /
              {{ previewState.groupSummaries.length }} 个命中分组
            </div>
            <a-button v-if="hasMoreGroups" @click="loadMoreGroups">加载更多分组</a-button>
          </div>
        </div>
      </div>

      <a-alert
        v-if="lastResult"
        type="success"
        show-icon
        :message="`最近一次已更新 ${lastResult.updatedEmojiCount} 个表情，涉及 ${lastResult.updatedFieldCount} 个字段。`"
        :description="`覆盖 ${lastResult.touchedGroupCount} 个分组，执行时间 ${new Date(lastResult.appliedAt).toLocaleString('zh-CN')}`"
      />
    </div>
  </div>
</template>
