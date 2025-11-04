<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

// Accept the project's Group shape when used from parent components
type LooseGroup = Record<string, unknown>
const props = defineProps<{ group: LooseGroup }>()

// use untyped emits to avoid tight coupling with parent Group types
// use a single emit for batch size updates (length/width)
const emit = defineEmits([
  'edit',
  'export',
  'exportZip',
  'dedupe',
  'confirmDelete',
  'batchUpdateSize',
  'viewDetail'
])

const onEdit = () => emit('edit', props.group)
const onExport = () => emit('export', props.group)
const onExportZip = () => emit('exportZip', props.group)
const onDedupe = () => emit('dedupe', props.group)
const onConfirmDelete = () => emit('confirmDelete', props.group)
const onBatchUpdateSize = () => emit('batchUpdateSize', props.group)
const onViewDetail = () => emit('viewDetail', props.group)
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
          <a-menu-item @click.prevent="onViewDetail">查看详细信息</a-menu-item>
          <a-menu-item @click.prevent="onExport">导出</a-menu-item>
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
