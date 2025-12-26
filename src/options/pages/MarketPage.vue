<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'

import { useEmojiStore } from '@/stores/emojiStore'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import type { EmojiGroup } from '@/types/type'

const emojiStore = useEmojiStore()

// 市场数据
const loading = ref(false)
const marketGroups = ref<
  Array<{
    id: string
    name: string
    icon: string
    detail?: string
    order: number
    emojiCount: number
    isArchived: boolean
  }>
>([])

const marketMetadata = ref<{
  version: string
  exportDate: string
  totalGroups: number
} | null>(null)

// 已加载详情的分组数据缓存
const groupDetailsCache = ref<Map<string, EmojiGroup>>(new Map())

// 已安装的分组 ID 集合
const installedGroupIds = computed(() => {
  const ids = new Set<string>()
  emojiStore.groups.forEach(g => ids.add(g.id))
  emojiStore.archivedGroups.forEach(g => ids.add(g.id))
  return ids
})

// 搜索关键词
const searchKeyword = ref('')

// 过滤后的市场分组
const filteredMarketGroups = computed(() => {
  if (!searchKeyword.value.trim()) {
    return marketGroups.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return marketGroups.value.filter(
    g =>
      g.name.toLowerCase().includes(keyword) ||
      (g.detail && g.detail.toLowerCase().includes(keyword))
  )
})

// 详情模态框
const showDetailModal = ref(false)
const detailLoading = ref(false)
const currentDetailGroup = ref<EmojiGroup | null>(null)

// 加载市场数据（仅加载 metadata）
const loadMarketData = async () => {
  try {
    loading.value = true

    // 从云端加载 metadata.json
    const metadataUrl = 'https://video2gif-pages.pages.dev/assets/market/metadata.json'
    const response = await fetch(metadataUrl)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    marketMetadata.value = {
      version: data.version,
      exportDate: data.exportDate,
      totalGroups: data.totalGroups
    }
    marketGroups.value = data.groups || []

    message.success(`成功加载 ${marketGroups.value.length} 个表情包`)
  } catch (error) {
    console.error('加载市场数据失败：', error)
    message.error('加载市场数据失败，请检查网络连接')
  } finally {
    loading.value = false
  }
}

// 加载分组详细数据（懒加载）
const loadGroupDetails = async (groupId: string): Promise<EmojiGroup | null> => {
  // 如果已经缓存，直接返回
  if (groupDetailsCache.value.has(groupId)) {
    return groupDetailsCache.value.get(groupId)!
  }

  try {
    // 从云端加载分组详细数据
    const groupUrl = `https://video2gif-pages.pages.dev/assets/market/group-${groupId}.json`
    const response = await fetch(groupUrl)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const groupData = await response.json()

    const detailGroup: EmojiGroup = {
      id: groupData.id,
      name: groupData.name,
      icon: groupData.icon,
      detail: groupData.detail,
      order: groupData.order || 0,
      emojis: (groupData.emojis || []).map((e: any) => ({
        id: e.id || `emoji-${Date.now()}-${Math.random()}`,
        packet: e.packet || Date.now(),
        name: e.name || '未命名',
        url: e.url,
        displayUrl: e.displayUrl,
        width: e.width,
        height: e.height,
        groupId: groupData.id
      }))
    }

    // 缓存数据
    groupDetailsCache.value.set(groupId, detailGroup)

    return detailGroup
  } catch (error) {
    console.error('加载分组详情失败：', error)
    message.error('加载分组详情失败，请稍后重试')
    return null
  }
}

// 查看分组详情
const viewGroupDetails = async (groupId: string) => {
  try {
    detailLoading.value = true
    showDetailModal.value = true

    const groupData = await loadGroupDetails(groupId)
    if (groupData) {
      currentDetailGroup.value = groupData
    }
  } finally {
    detailLoading.value = false
  }
}

// 关闭详情模态框
const closeDetailModal = () => {
  showDetailModal.value = false
  currentDetailGroup.value = null
}

// 安装表情包
const installingGroupIds = ref(new Set<string>())

const installGroup = async (groupId: string) => {
  try {
    installingGroupIds.value.add(groupId)

    // 懒加载分组详细数据
    const groupData = await loadGroupDetails(groupId)
    if (!groupData) {
      installingGroupIds.value.delete(groupId)
      return
    }

    // 检查是否已存在同名分组
    const existingGroup = emojiStore.groups.find(g => g.name === groupData.name)
    if (existingGroup) {
      const confirm = await new Promise<boolean>(resolve => {
        // 简单的确认对话框
        resolve(window.confirm(`已存在名为「${groupData.name}」的分组，是否覆盖？`))
      })

      if (!confirm) {
        installingGroupIds.value.delete(groupId)
        return
      }

      // 删除旧分组
      emojiStore.deleteGroup(existingGroup.id)
    }

    // 创建新分组
    emojiStore.createGroup(groupData.name, groupData.icon, groupData.detail || '')

    // 更新刚创建的分组，设置正确的 ID 和表情
    const createdGroup = emojiStore.groups[emojiStore.groups.length - 1]
    if (createdGroup) {
      // 更新分组 ID 和表情
      emojiStore.updateGroup(createdGroup.id, {
        id: groupData.id,
        emojis: groupData.emojis
      })
    }

    message.success(`成功安装表情包「${groupData.name}」`)
  } catch (error) {
    console.error('安装表情包失败：', error)
    message.error('安装表情包失败，请稍后重试')
  } finally {
    installingGroupIds.value.delete(groupId)
  }
}

onMounted(() => {
  loadMarketData()
})
</script>

<template>
  <div class="market-page h-full flex flex-col">
    <!-- 顶部操作栏 -->
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold dark:text-white">云端市场</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          从云端浏览和安装表情包
          <template v-if="marketMetadata">- 共 {{ marketMetadata.totalGroups }} 个表情包</template>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <a-button @click="loadMarketData" :loading="loading">刷新</a-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="mb-4">
      <a-input-search
        v-model:value="searchKeyword"
        placeholder="搜索表情包名称或描述..."
        allow-clear
        size="large"
        class="max-w-md"
      />
    </div>

    <!-- 市场列表 -->
    <a-spin :spinning="loading" class="flex-1">
      <div v-if="filteredMarketGroups.length === 0 && !loading" class="text-center py-12">
        <p class="text-gray-400">
          {{ searchKeyword ? '没有找到匹配的表情包' : '暂无可用的表情包' }}
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="group in filteredMarketGroups"
          :key="group.id"
          class="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow"
        >
          <!-- 表情包头部 -->
          <div class="flex items-start gap-3 mb-3">
            <template v-if="isImageUrl(normalizeImageUrl(group.icon))">
              <img
                :src="normalizeImageUrl(group.icon)"
                alt="icon"
                class="w-12 h-12 object-contain rounded"
              />
            </template>
            <span v-else class="text-3xl">{{ group.icon || '📁' }}</span>

            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-lg dark:text-white truncate">{{ group.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ group.emojiCount }} 个表情
                <span v-if="group.isArchived" class="ml-2 text-xs text-orange-500">(已归档)</span>
              </p>
            </div>
          </div>

          <!-- 表情包描述 -->
          <p v-if="group.detail" class="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
            {{ group.detail }}
          </p>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2">
            <a-button @click="viewGroupDetails(group.id)" class="flex-1">查看详情</a-button>
            <a-button v-if="installedGroupIds.has(group.id)" type="default" disabled class="flex-1">
              已安装
            </a-button>
            <a-button
              v-else
              type="primary"
              :loading="installingGroupIds.has(group.id)"
              @click="installGroup(group.id)"
              class="flex-1"
            >
              安装
            </a-button>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="showDetailModal"
      :title="currentDetailGroup?.name || '表情包详情'"
      width="80%"
      :footer="null"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentDetailGroup" class="space-y-4">
          <!-- 分组基本信息 -->
          <div class="flex items-start gap-3 pb-4 border-b dark:border-gray-700">
            <template v-if="isImageUrl(normalizeImageUrl(currentDetailGroup.icon))">
              <img
                :src="normalizeImageUrl(currentDetailGroup.icon)"
                alt="icon"
                class="w-16 h-16 object-contain rounded"
              />
            </template>
            <span v-else class="text-5xl">{{ currentDetailGroup.icon || '📁' }}</span>

            <div class="flex-1">
              <h3 class="text-xl font-semibold dark:text-white mb-2">
                {{ currentDetailGroup.name }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                共 {{ currentDetailGroup.emojis?.length || 0 }} 个表情
              </p>
              <p v-if="currentDetailGroup.detail" class="text-sm text-gray-600 dark:text-gray-300">
                {{ currentDetailGroup.detail }}
              </p>
            </div>
          </div>

          <!-- 表情网格 -->
          <div class="mt-4">
            <h4 class="font-semibold mb-3 dark:text-white">表情预览</h4>
            <div
              v-if="currentDetailGroup.emojis && currentDetailGroup.emojis.length > 0"
              class="grid gap-2"
              :style="{
                gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns || 6}, minmax(0, 1fr))`
              }"
            >
              <div
                v-for="emoji in currentDetailGroup.emojis"
                :key="emoji.id"
                class="relative group/emoji aspect-square"
              >
                <img
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
              </div>
            </div>
            <div v-else class="text-center text-gray-400 py-8">此分组没有表情</div>
          </div>

          <!-- 底部操作按钮 -->
          <div class="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <a-button @click="closeDetailModal">关闭</a-button>
            <a-button
              v-if="!installedGroupIds.has(currentDetailGroup.id)"
              type="primary"
              :loading="installingGroupIds.has(currentDetailGroup.id)"
              @click="
                installGroup(currentDetailGroup.id).then(() => {
                  closeDetailModal()
                })
              "
            >
              安装
            </a-button>
            <a-button v-else type="default" disabled>已安装</a-button>
          </div>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<style scoped>
.market-page {
  min-height: 600px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
