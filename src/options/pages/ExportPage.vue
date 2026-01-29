<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import CachedImage from '@/components/CachedImage.vue'
import { useEmojiStore } from '@/stores/emojiStore'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import { buildEmojiExportItem, exportToCloudMarket } from '@/options/utils/exportUtils'
import type { Emoji, EmojiGroup } from '@/types/type'

const emojiStore = useEmojiStore()

const loading = ref(false)

// 当前选中的分组（左侧显示）
const selectedGroupIds = ref<Set<string>>(new Set())

// 选中的表情（右侧可勾选）
const selectedEmojis = ref<Map<string, Set<string>>>(new Map()) // groupId -> Set<emojiId>

// 所有分组（包括普通分组和归档分组）
const allGroups = computed(() => {
  const groups: Array<EmojiGroup & { isArchived?: boolean }> = []
  // 普通分组
  for (const g of emojiStore.groups) {
    groups.push({ ...g, isArchived: false })
  }
  // 归档分组
  for (const g of emojiStore.archivedGroups) {
    groups.push({ ...g, isArchived: true })
  }
  return groups
})

// 当前右侧显示的分组
const displayedGroups = computed(() => {
  return allGroups.value.filter(g => selectedGroupIds.value.has(g.id))
})

// 切换分组选择
const toggleGroupSelection = (groupId: string) => {
  if (selectedGroupIds.value.has(groupId)) {
    selectedGroupIds.value.delete(groupId)
    selectedEmojis.value.delete(groupId)
  } else {
    selectedGroupIds.value.add(groupId)
  }
}

// 全选分组内的所有表情
const selectAllEmojisInGroup = (group: EmojiGroup) => {
  const emojiIds = new Set((group.emojis || []).map(e => e.id))
  selectedEmojis.value.set(group.id, emojiIds)
}

// 取消全选分组内的所有表情
const deselectAllEmojisInGroup = (groupId: string) => {
  selectedEmojis.value.delete(groupId)
}

// 切换单个表情选择
const toggleEmojiSelection = (groupId: string, emojiId: string) => {
  if (!selectedEmojis.value.has(groupId)) {
    selectedEmojis.value.set(groupId, new Set())
  }
  const groupSet = selectedEmojis.value.get(groupId)!
  if (groupSet.has(emojiId)) {
    groupSet.delete(emojiId)
  } else {
    groupSet.add(emojiId)
  }
}

const isEmojiSelected = (groupId: string, emojiId: string): boolean => {
  return selectedEmojis.value.get(groupId)?.has(emojiId) || false
}

const isAllEmojisSelected = (group: EmojiGroup): boolean => {
  const emojis = group.emojis || []
  if (emojis.length === 0) return false
  const selected = selectedEmojis.value.get(group.id)
  if (!selected) return false
  return emojis.every(e => selected.has(e.id))
}

// 计算选中数量
const selectedCount = computed(() => {
  let count = 0
  for (const emojiSet of selectedEmojis.value.values()) {
    count += emojiSet.size
  }
  return count
})

const clearSelection = () => {
  selectedEmojis.value.clear()
}

// 导出进度状态
const exportProgress = ref({
  visible: false,
  current: 0,
  total: 0,
  currentGroupName: ''
})

// 导出活跃分组到云端市场（不包括归档）
const isExportingActiveGroups = ref(false)
const exportActiveGroupsToMarket = async () => {
  try {
    isExportingActiveGroups.value = true
    exportProgress.value.visible = true
    exportProgress.value.current = 0
    exportProgress.value.total = 0
    exportProgress.value.currentGroupName = ''

    await exportToCloudMarket(
      emojiStore.groups,
      emojiStore.archivedGroups,
      false,
      (current, total, groupName) => {
        exportProgress.value.current = current
        exportProgress.value.total = total
        exportProgress.value.currentGroupName = groupName
      }
    )

    message.success(`导出完成！共导出 ${emojiStore.groups.length} 个活跃分组`)
  } catch (error) {
    console.error('导出活跃分组到云端市场失败：', error)
    message.error('导出失败，请查看控制台了解详情')
  } finally {
    isExportingActiveGroups.value = false
    setTimeout(() => {
      exportProgress.value.visible = false
    }, 500)
  }
}

// 导出所有分组到云端市场（包括归档）
const isExportingAllGroups = ref(false)
const exportAllGroupsToMarket = async () => {
  try {
    isExportingAllGroups.value = true
    exportProgress.value.visible = true
    exportProgress.value.current = 0
    exportProgress.value.total = 0
    exportProgress.value.currentGroupName = ''

    await exportToCloudMarket(
      emojiStore.groups,
      emojiStore.archivedGroups,
      true,
      (current, total, groupName) => {
        exportProgress.value.current = current
        exportProgress.value.total = total
        exportProgress.value.currentGroupName = groupName
      }
    )

    message.success(
      `导出完成！共导出 ${emojiStore.groups.length + emojiStore.archivedGroups.length} 个分组`
    )
  } catch (error) {
    console.error('导出所有分组到云端市场失败：', error)
    message.error('导出失败，请查看控制台了解详情')
  } finally {
    isExportingAllGroups.value = false
    setTimeout(() => {
      exportProgress.value.visible = false
    }, 500)
  }
}

// 导出 JSON
const exportSelectedAsJson = () => {
  const exportData: {
    version: string
    exportDate: string
    groups: Array<{
      id: string
      name: string
      icon: string
      detail?: string
      order: number
      emojis: Emoji[]
    }>
  } = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    groups: []
  }

  for (const group of allGroups.value) {
    const selectedEmojiIds = selectedEmojis.value.get(group.id)
    if (!selectedEmojiIds || selectedEmojiIds.size === 0) continue

    const emojis = (group.emojis || []).filter(e => selectedEmojiIds.has(e.id))
    if (emojis.length === 0) continue

    exportData.groups.push({
      id: group.id,
      name: group.name,
      icon: group.icon,
      detail: group.detail,
      order: group.order,
      emojis: emojis.map(e => buildEmojiExportItem(e, group.id))
    })
  }

  if (exportData.groups.length === 0) {
    return
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `emoji-export-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  loading.value = true
  try {
    await emojiStore.refreshArchivedGroups()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="export-page h-full flex flex-col">
    <!-- 顶部操作栏 -->
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold dark:text-white">导出表情</h2>
      <div class="flex items-center gap-2">
        <a-button
          type="primary"
          :loading="isExportingActiveGroups"
          @click="exportActiveGroupsToMarket"
          title="导出所有活跃分组（不包括归档）到云端市场格式"
        >
          一键以云端格式导出活跃分组
        </a-button>
        <a-button
          type="default"
          :loading="isExportingAllGroups"
          @click="exportAllGroupsToMarket"
          title="导出所有分组（包括归档）到云端市场格式"
        >
          一键以云端格式导出所有分组
        </a-button>
        <template v-if="selectedCount > 0">
          <span class="text-sm text-gray-500">已选 {{ selectedCount }} 个表情</span>
          <a-button type="primary" @click="exportSelectedAsJson">导出 JSON</a-button>
          <a-button @click="clearSelection">清除选择</a-button>
        </template>
      </div>
    </div>

    <a-spin :spinning="loading" class="flex-1">
      <div class="flex gap-4 h-full">
        <!-- 左侧：分组选择器 -->
        <div
          class="w-64 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden flex flex-col"
        >
          <div class="p-3 border-b dark:border-gray-700 font-medium dark:text-white">选择分组</div>
          <div class="flex-1 overflow-y-auto p-2">
            <!-- 普通分组 -->
            <div v-if="emojiStore.groups.length > 0" class="mb-4">
              <div class="text-xs text-gray-400 px-2 mb-1">普通分组</div>
              <div
                v-for="group in emojiStore.groups"
                :key="group.id"
                class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="{ 'bg-blue-50 dark:bg-blue-900/30': selectedGroupIds.has(group.id) }"
                @click="toggleGroupSelection(group.id)"
              >
                <a-checkbox :checked="selectedGroupIds.has(group.id)" @click.stop />
                <template v-if="isImageUrl(normalizeImageUrl(group.icon))">
                  <CachedImage
                    :src="normalizeImageUrl(group.icon)"
                    alt="icon"
                    class="w-5 h-5 object-contain rounded"
                  />
                </template>
                <span v-else class="text-lg">{{ group.icon || '📁' }}</span>
                <span class="flex-1 truncate text-sm dark:text-white">{{ group.name }}</span>
                <span class="text-xs text-gray-400">{{ group.emojis?.length || 0 }}</span>
              </div>
            </div>

            <!-- 归档分组 -->
            <div v-if="emojiStore.archivedGroups.length > 0">
              <div class="text-xs text-gray-400 px-2 mb-1">已归档</div>
              <div
                v-for="group in emojiStore.archivedGroups"
                :key="group.id"
                class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="{ 'bg-blue-50 dark:bg-blue-900/30': selectedGroupIds.has(group.id) }"
                @click="toggleGroupSelection(group.id)"
              >
                <a-checkbox :checked="selectedGroupIds.has(group.id)" @click.stop />
                <template v-if="isImageUrl(normalizeImageUrl(group.icon))">
                  <CachedImage
                    :src="normalizeImageUrl(group.icon)"
                    alt="icon"
                    class="w-5 h-5 object-contain rounded"
                  />
                </template>
                <span v-else class="text-lg">{{ group.icon || '📁' }}</span>
                <span class="flex-1 truncate text-sm dark:text-white">{{ group.name }}</span>
                <span class="text-xs text-gray-400">{{ group.emojis?.length || 0 }}</span>
              </div>
            </div>

            <div
              v-if="emojiStore.groups.length === 0 && emojiStore.archivedGroups.length === 0"
              class="text-center text-gray-400 py-8"
            >
              暂无分组
            </div>
          </div>
        </div>

        <!-- 右侧：表情展示区 -->
        <div
          class="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden flex flex-col"
        >
          <div class="p-3 border-b dark:border-gray-700 font-medium dark:text-white">表情列表</div>
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="displayedGroups.length === 0" class="text-center text-gray-400 py-12">
              请在左侧选择分组
            </div>

            <div v-else class="space-y-6">
              <div
                v-for="group in displayedGroups"
                :key="group.id"
                class="border dark:border-gray-700 rounded-lg p-4"
              >
                <!-- 分组标题 -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <template v-if="isImageUrl(normalizeImageUrl(group.icon))">
                      <CachedImage
                        :src="normalizeImageUrl(group.icon)"
                        alt="icon"
                        class="w-6 h-6 object-contain rounded"
                      />
                    </template>
                    <span v-else class="text-xl">{{ group.icon || '📁' }}</span>
                    <span class="font-medium dark:text-white">{{ group.name }}</span>
                    <span
                      v-if="group.isArchived"
                      class="text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded"
                    >
                      已归档
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500">
                      {{ selectedEmojis.get(group.id)?.size || 0 }} /
                      {{ group.emojis?.length || 0 }}
                    </span>
                    <a-button
                      v-if="!isAllEmojisSelected(group)"
                      size="small"
                      @click="selectAllEmojisInGroup(group)"
                    >
                      全选
                    </a-button>
                    <a-button v-else size="small" @click="deselectAllEmojisInGroup(group.id)">
                      取消全选
                    </a-button>
                  </div>
                </div>

                <!-- 表情网格 -->
                <div
                  v-if="group.emojis && group.emojis.length > 0"
                  class="grid gap-2"
                  :style="{
                    gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns || 6}, minmax(0, 1fr))`
                  }"
                >
                  <div
                    v-for="emoji in group.emojis"
                    :key="emoji.id"
                    class="relative group/emoji aspect-square cursor-pointer"
                    :class="{
                      'ring-2 ring-blue-500 rounded': isEmojiSelected(group.id, emoji.id)
                    }"
                    @click="toggleEmojiSelection(group.id, emoji.id)"
                  >
                    <CachedImage
                      :src="emoji.displayUrl || emoji.url"
                      :alt="emoji.name"
                      :title="emoji.name"
                      class="w-full h-full object-contain rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                    />
                    <div
                      class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate opacity-0 group-hover/emoji:opacity-100 transition-opacity"
                    >
                      {{ emoji.name }}
                    </div>
                    <!-- 选中标记 -->
                    <div
                      v-if="isEmojiSelected(group.id, emoji.id)"
                      class="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs"
                    >
                      ✓
                    </div>
                  </div>
                </div>

                <div v-else class="text-center text-gray-400 py-4">此分组没有表情</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 导出进度弹窗 -->
    <a-modal
      v-model:open="exportProgress.visible"
      title="导出进度"
      :footer="null"
      :closable="false"
      :maskClosable="false"
    >
      <div class="py-4">
        <a-progress
          :percent="
            exportProgress.total > 0
              ? Math.round((exportProgress.current / exportProgress.total) * 100)
              : 0
          "
          :status="exportProgress.current === exportProgress.total ? 'success' : 'active'"
        />
        <div class="mt-3 text-center text-gray-600 dark:text-gray-300">
          <div class="text-sm">
            正在导出：
            <span class="font-medium">{{ exportProgress.currentGroupName }}</span>
          </div>
          <div class="text-xs mt-1 text-gray-400">
            {{ exportProgress.current }} / {{ exportProgress.total }}
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.export-page {
  min-height: 600px;
}
</style>
