<script setup lang="ts">
import { computed } from 'vue'

// Accept the project's Group shape when used from parent components
type LooseGroup = Record<string, unknown>
const props = defineProps<{ group: LooseGroup }>()

// use untyped emits to avoid tight coupling with parent Group types
// use a single emit for batch size updates (length/width)
const emit = defineEmits([
  'edit',
  'telegramUpdate',
  'export',
  'exportZip',
  'dedupe',
  'confirmDelete',
  'batchUpdateSize',
  'viewDetail',
  'aiRename',
  'archive',
  'copyAsMarkdown',
  'clearCache'
])

const onEdit = () => emit('edit', props.group)
const onTelegramUpdate = () => emit('telegramUpdate', props.group)
const onExport = () => emit('export', props.group)
const onExportZip = () => emit('exportZip', props.group)
const onDedupe = () => emit('dedupe', props.group)
const onConfirmDelete = () => emit('confirmDelete', props.group)
const onBatchUpdateSize = () => emit('batchUpdateSize', props.group)
const onViewDetail = () => emit('viewDetail', props.group)
const onAIRename = () => emit('aiRename', props.group)
const onArchive = () => emit('archive', props.group)
const onCopyAsMarkdown = () => emit('copyAsMarkdown', props.group)
const onClearCache = () => emit('clearCache', props.group)

const isTelegramGroup = computed(() => {
  const group: any = props.group || {}
  const id = String(group.id || '')
  const detail = String(group.detail || '')
  return id.startsWith('telegram_') || detail.includes('Telegram 贴纸包：')
})
</script>

<template>
  <div class="relative">
    <a-dropdown placement="bottomRight">
      <a-button
        class="px-3 py-1 text-sm rounded border bg-white dark:border-gray-700 dark:bg-gray-800"
      >
        更多操作
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item @click.prevent="onEdit">编辑</a-menu-item>
          <a-menu-item v-if="isTelegramGroup" @click.prevent="onTelegramUpdate">
            更新（Telegram）
          </a-menu-item>
          <a-menu-item @click.prevent="onViewDetail">查看详细信息</a-menu-item>
          <a-menu-item @click.prevent="onExport">导出</a-menu-item>
          <a-menu-item @click.prevent="onCopyAsMarkdown">复制为 Markdown</a-menu-item>
          <a-menu-item @click.prevent="onAIRename">AI 批量重命名</a-menu-item>
          <a-menu-item @click.prevent="onBatchUpdateSize">批量更新尺寸</a-menu-item>
          <a-popconfirm
            placement="top"
            title="确认要打包下载此分组吗？"
            ok-text="确定"
            cancel-text="取消"
            @confirm="onExportZip"
          >
            <a-menu-item>打包下载</a-menu-item>
          </a-popconfirm>
          <a-menu-item @click.prevent="onDedupe">去重</a-menu-item>
          <a-popconfirm
            placement="top"
            title="确认清空此分组的图片缓存吗？"
            ok-text="确定"
            cancel-text="取消"
            @confirm="onClearCache"
          >
            <a-menu-item>清空缓存</a-menu-item>
          </a-popconfirm>
          <a-popconfirm
            placement="top"
            title="确认要归档此分组吗？归档后将不在日常页面显示"
            ok-text="确定"
            cancel-text="取消"
            @confirm="onArchive"
          >
            <a-menu-item>归档</a-menu-item>
          </a-popconfirm>
          <a-menu-item @click.prevent="onConfirmDelete">
            <span style="color: #e11d48">删除</span>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped>
/* styling intentionally minimal; parent components provide spacing */
</style>
