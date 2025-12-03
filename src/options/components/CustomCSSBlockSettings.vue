<script setup lang="ts">
import { ref, computed, isRef, type Ref, h } from 'vue'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue'

import type { AppSettings, CustomCssBlock } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const emit = defineEmits(['update:customCss', 'update:customCssBlocks'])

// State
const showBlockModal = ref(false)
const showBlockEditor = ref(false)
const editingBlock = ref<CustomCssBlock | null>(null)
const localBlockName = ref('')
const localBlockContent = ref('')
const localBlockEnabled = ref(true)

// Modal state
const modalMode = ref<'create' | 'edit'>('create')

// Computed
const currentSettings = computed(() => isRef(props.settings) ? props.settings.value : props.settings)
const cssBlocks = computed(() => currentSettings.value.customCssBlocks || [])

// Methods
const openBlockManager = () => {
  showBlockModal.value = true
}

const closeBlockManager = () => {
  showBlockModal.value = false
}

const createNewBlock = () => {
  modalMode.value = 'create'
  editingBlock.value = null
  localBlockName.value = ''
  localBlockContent.value = ''
  localBlockEnabled.value = true
  showBlockEditor.value = true
}

const editBlock = (block: CustomCssBlock) => {
  modalMode.value = 'edit'
  editingBlock.value = block
  localBlockName.value = block.name
  localBlockContent.value = block.content
  localBlockEnabled.value = block.enabled
  showBlockEditor.value = true
}

const saveBlock = () => {
  if (!localBlockName.value.trim()) {
    return
  }

  const block: CustomCssBlock = {
    id: editingBlock.value?.id || `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: localBlockName.value.trim(),
    content: localBlockContent.value,
    enabled: localBlockEnabled.value,
    createdAt: editingBlock.value?.createdAt || Date.now(),
    updatedAt: Date.now()
  }

  emit('update:customCssBlocks', block)
  closeBlockEditor()
}

const closeBlockEditor = () => {
  showBlockEditor.value = false
  editingBlock.value = null
  localBlockName.value = ''
  localBlockContent.value = ''
  localBlockEnabled.value = true
}

const toggleBlock = (block: CustomCssBlock) => {
  emit('update:customCssBlocks', { ...block, enabled: !block.enabled })
}

const deleteBlock = (block: CustomCssBlock) => {
  emit('update:customCssBlocks', { type: 'delete', id: block.id })
}

const getCombinedCss = () => {
  return cssBlocks.value
    .filter(block => block.enabled)
    .map(block => block.content)
    .join('\n\n')
    .trim()
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">自定义 CSS 块</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900 dark:text-white">自定义 CSS 块管理</label>
          <p class="text-sm text-gray-500 dark:text-white">
            创建和管理多个 CSS 块，支持独立开关控制（仅在支持的平台注入）
          </p>
        </div>
        <div>
          <a-button @click="openBlockManager" title="打开 CSS 块管理器">
            管理 CSS 块 ({{ cssBlocks.length }})
          </a-button>
        </div>
      </div>

      <!-- Combined CSS Preview -->
      <div v-if="getCombinedCss()">
        <label class="text-sm font-medium text-gray-900 dark:text-white">当前生效的 CSS</label>
        <div class="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
          <pre class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{{ getCombinedCss() }}</pre>
        </div>
      </div>

      <!-- Block Manager Modal -->
      <div v-if="showBlockModal" class="fixed inset-0 flex items-center justify-center z-50">
        <div
          class="fixed inset-0 bg-black bg-opacity-50"
          @click="closeBlockManager"
          title="点击关闭"
        ></div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col relative z-10">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold dark:text-white">CSS 块管理</h3>
            <a-button @click="closeBlockManager" size="small">关闭</a-button>
          </div>

          <div class="flex-1 overflow-hidden p-6">
            <div class="h-full overflow-y-auto">
              <div class="mb-4">
                <a-button type="primary" @click="createNewBlock" :icon="h(PlusOutlined)">
                  新建 CSS 块
                </a-button>
              </div>

              <div v-if="cssBlocks.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                暂无 CSS 块，点击上方按钮创建
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="block in cssBlocks"
                  :key="block.id"
                  class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  :class="{
                    'bg-gray-50 dark:bg-gray-900': !block.enabled,
                    'bg-white dark:bg-gray-800': block.enabled
                  }"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-3">
                      <a-button
                        :type="block.enabled ? 'primary' : 'default'"
                        size="small"
                        @click="toggleBlock(block)"
                        :icon="block.enabled ? h(EyeOutlined) : h(EyeInvisibleOutlined)"
                      >
                        {{ block.enabled ? '已启用' : '已禁用' }}
                      </a-button>
                      <h4 class="font-medium dark:text-white">{{ block.name }}</h4>
                    </div>
                    <div class="flex items-center space-x-2">
                      <a-button size="small" @click="editBlock(block)" :icon="h(EditOutlined)">
                        编辑
                      </a-button>
                      <a-button size="small" danger @click="deleteBlock(block)" :icon="h(DeleteOutlined)">
                        删除
                      </a-button>
                    </div>
                  </div>

                  <div v-if="block.content" class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <div class="bg-gray-100 dark:bg-gray-900 rounded p-2 max-h-32 overflow-y-auto">
                      <pre class="text-xs font-mono whitespace-pre-wrap">{{ block.content }}</pre>
                    </div>
                  </div>

                  <div class="text-xs text-gray-500 dark:text-gray-500">
                    创建时间：{{ formatDate(block.createdAt) }}
                    <span v-if="block.updatedAt !== block.createdAt" class="ml-3">
                      更新时间：{{ formatDate(block.updatedAt) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Block Editor Modal -->
      <div v-if="showBlockEditor" class="fixed inset-0 flex items-center justify-center z-50">
        <div
          class="fixed inset-0 bg-black bg-opacity-50"
          @click="closeBlockEditor"
          title="点击关闭"
        ></div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-3/4 max-w-3xl relative z-10">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold dark:text-white">
              {{ modalMode === 'create' ? '创建 CSS 块' : '编辑 CSS 块' }}
            </h3>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                CSS 块名称
              </label>
              <a-input
                v-model:value="localBlockName"
                placeholder="输入 CSS 块名称"
                class="w-full"
              />
            </div>

            <div>
              <label class="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white mb-1">
                <input
                  type="checkbox"
                  v-model="localBlockEnabled"
                  class="rounded border-gray-300"
                />
                <span>启用此 CSS 块</span>
              </label>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                CSS 内容
              </label>
              <textarea
                v-model="localBlockContent"
                rows="12"
                class="w-full p-3 border rounded dark:bg-gray-900 dark:text-white font-mono text-sm"
                placeholder="输入 CSS 代码..."
              ></textarea>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
            <a-button @click="closeBlockEditor">取消</a-button>
            <a-button type="primary" @click="saveBlock" :disabled="!localBlockName.trim()">
              {{ modalMode === 'create' ? '创建' : '保存' }}
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>