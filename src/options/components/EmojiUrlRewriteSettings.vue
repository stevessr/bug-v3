<script setup lang="ts">
import { computed, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'

import { useEmojiStore } from '@/stores'
import {
  buildEmojiUrlRewriteRegex,
  rewriteEmojiUrlFields,
  rewriteEmojiUrlValue,
  type EmojiUrlRewriteField
} from '@/utils/emojiUrlRewrite'

type PreviewExample = {
  emojiId: string
  emojiName: string
  groupName: string
  before: string
  after: string
  changedFields: EmojiUrlRewriteField[]
}

type RewriteSummary = {
  updatedEmojiCount: number
  updatedFieldCount: number
  touchedGroupCount: number
  examples: PreviewExample[]
}

const emojiStore = useEmojiStore()

const pattern = ref('')
const flags = ref('g')
const replacement = ref('')
const exampleUrl = ref('')
const isApplying = ref(false)
const lastResult = ref<{
  updatedEmojiCount: number
  updatedFieldCount: number
  touchedGroupCount: number
  appliedAt: number
} | null>(null)

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

const rewriteSummary = computed<RewriteSummary>(() => {
  const regex = regexState.value.regex
  if (!regex) {
    return {
      updatedEmojiCount: 0,
      updatedFieldCount: 0,
      touchedGroupCount: 0,
      examples: []
    }
  }

  let updatedEmojiCount = 0
  let updatedFieldCount = 0
  let touchedGroupCount = 0
  const examples: PreviewExample[] = []

  for (const group of emojiStore.groups) {
    let groupMatched = false

    for (const emoji of group.emojis || []) {
      if (!emoji) continue

      const rewriteResult = rewriteEmojiUrlFields(emoji, regex, replacement.value)
      if (!rewriteResult.changed) continue

      updatedEmojiCount++
      updatedFieldCount += rewriteResult.changedFields.length
      groupMatched = true

      if (examples.length < 6) {
        const primaryField = rewriteResult.changedFields[0]
        examples.push({
          emojiId: emoji.id,
          emojiName: emoji.name,
          groupName: group.name,
          before: String(emoji[primaryField] || ''),
          after: String(rewriteResult.emoji[primaryField] || ''),
          changedFields: rewriteResult.changedFields
        })
      }
    }

    if (groupMatched) {
      touchedGroupCount++
    }
  }

  return {
    updatedEmojiCount,
    updatedFieldCount,
    touchedGroupCount,
    examples
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

const canApply = computed(
  () => !!regexState.value.regex && rewriteSummary.value.updatedEmojiCount > 0 && !isApplying.value
)

const fieldLabelMap: Record<EmojiUrlRewriteField, string> = {
  url: 'url',
  displayUrl: 'displayUrl',
  originUrl: 'originUrl'
}

const formatFields = (fields: EmojiUrlRewriteField[]) => fields.map(field => fieldLabelMap[field])

const applyRewrite = () => {
  const regex = regexState.value.regex
  if (!regex) {
    message.error(regexState.value.error || '请先输入有效的正则表达式')
    return
  }

  if (rewriteSummary.value.updatedEmojiCount === 0) {
    message.info('没有匹配到需要更新的表情 URL')
    return
  }

  const preview = rewriteSummary.value
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
              {{ rewriteSummary.updatedEmojiCount }}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">预计会被更新的表情数量</div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
              <div class="text-xs text-gray-500 dark:text-gray-400">字段数</div>
              <div class="text-lg font-medium dark:text-white">
                {{ rewriteSummary.updatedFieldCount }}
              </div>
            </div>
            <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
              <div class="text-xs text-gray-500 dark:text-gray-400">分组数</div>
              <div class="text-lg font-medium dark:text-white">
                {{ rewriteSummary.touchedGroupCount }}
              </div>
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            当前总表情数：{{ totalEmojiCount }}
          </div>
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
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">命中示例</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              展示前 6 个会被修改的实际表情，便于确认规则是否正确。
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

        <div
          v-if="rewriteSummary.examples.length === 0"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400"
        >
          {{
            regexState.isReady
              ? '当前没有匹配到需要更新的表情 URL。'
              : '先输入正则表达式和替换内容，再查看命中结果。'
          }}
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in rewriteSummary.examples"
            :key="item.emojiId"
            class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div class="font-medium dark:text-white">{{ item.emojiName }}</div>
              <a-tag>{{ item.groupName }}</a-tag>
              <a-tag v-for="field in formatFields(item.changedFields)" :key="field" color="blue">
                {{ field }}
              </a-tag>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">修改前</div>
                <div class="break-all font-mono text-xs dark:text-gray-200">{{ item.before }}</div>
              </div>
              <div
                class="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3"
              >
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">修改后</div>
                <div class="break-all font-mono text-xs dark:text-gray-200">{{ item.after }}</div>
              </div>
            </div>
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
