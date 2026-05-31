<script setup lang="ts">
import { ref, shallowRef, onMounted, computed, watch } from 'vue'

import CachedImage from '@/components/CachedImage.vue'
import { useEmojiStore } from '@/stores/emojiStore'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import type { EmojiGroup } from '@/types/type'
import { requestConfirmation } from '@/options/utils/confirmService'

const { t } = useI18n()

const emojiStore = useEmojiStore()

type MarketTopicId =
  | 'all'
  | 'bilibili'
  | 'telegram'
  | 'x'
  | 'other'
  | 'OC'
  | 'emoji'
  | 'animated'
  | 'linux.do'
  | 'tieba'
  | '>100' // 预留一个特殊 topic，用于标记超过 100 个表情包的分组

type MarketGroupSummary = {
  id: string
  name: string
  icon: string
  detail?: string
  topic?: MarketTopicId
  order: number
  emojiCount: number
  isArchived: boolean
}

type MarketTopicSummary = {
  id: MarketTopicId
  label: string
  totalGroups: number
  totalPages: number
}

// 获取云端市场基础 URL
const getMarketBaseUrl = () => {
  const domain = emojiStore.settings.cloudMarketDomain || 's.pwsh.us.kg'
  return `https://${domain}`
}

// 市场数据
const loading = ref(false)
// 优化：使用 shallowRef 减少大数组的响应式代理开销
const marketGroups = shallowRef<MarketGroupSummary[]>([])
const fullMarketGroups = shallowRef<MarketGroupSummary[]>([])

const marketMetadata = ref<{
  version: string
  exportDate: string
  totalGroups: number
} | null>(null)

const currentPage = ref(1)
const pageSize = ref(48)
const indexPageSize = ref(48)
const totalMarketGroups = ref(0)
const usePagedIndex = ref(false)
const isSearchMode = ref(false)
const hasLoadedFullMarketMetadata = ref(false)
const hasTopicIndex = ref(false)
const selectedTopic = ref<MarketTopicId>('all')

const defaultMarketTopics: MarketTopicSummary[] = [
  { id: 'all', label: '全部', totalGroups: 0, totalPages: 1 },
  { id: 'bilibili', label: 'bilibili', totalGroups: 0, totalPages: 1 },
  { id: 'telegram', label: 'telegram', totalGroups: 0, totalPages: 1 },
  { id: 'x', label: 'X', totalGroups: 0, totalPages: 1 },
  { id: 'other', label: '其他', totalGroups: 0, totalPages: 1 },
  { id: 'OC', label: 'OC', totalGroups: 0, totalPages: 1 },
  { id: 'emoji', label: 'emoji', totalGroups: 0, totalPages: 1 },
  { id: 'animated', label: '动画表情', totalGroups: 0, totalPages: 1 },
  { id: 'linux.do', label: 'linux.do', totalGroups: 0, totalPages: 1 },
  { id: 'tieba', label: '贴吧', totalGroups: 0, totalPages: 1 },
  { id: '>100', label: '100+', totalGroups: 0, totalPages: 1 }
]

const marketTopics = shallowRef<MarketTopicSummary[]>(defaultMarketTopics)

// 优化：使用 shallowRef 减少缓存 Map 的响应式代理开销
const groupDetailsCache = shallowRef<Map<string, EmojiGroup>>(new Map())

// 已安装的分组 ID 集合
const installedGroupIds = computed(() => {
  const ids = new Set<string>()
  emojiStore.groups.forEach(g => ids.add(g.id))
  emojiStore.archivedGroups.forEach(g => ids.add(g.id))
  return ids
})

// 搜索关键词
const searchKeyword = ref('')

const resolveMarketTopic = (group: MarketGroupSummary): MarketTopicId => {
  const detail = group.detail?.toLowerCase() || ''
  const name = group.name.trim().toLowerCase()

  if (detail.includes('t.me')) return 'telegram'
  if (detail.includes('bili')) return 'bilibili'
  if (name.startsWith('x')) return 'x'
  if (name.includes('oc') || detail.includes('oc') || name.includes('steve')) return 'OC'
  if (name.includes('emoji')) return 'emoji'
  if (name.includes('animated') || name.includes('动图')) return 'animated'
  if (name.includes('linux.do') || detail.includes('linux.do')) return 'linux.do'
  if (name.includes('tieba') || detail.includes('tieba') || detail.includes('贴吧')) return 'tieba'
  if (group.emojiCount > 100) return '>100'
  return 'other'
}

const buildMarketTopicSummaries = (groups: MarketGroupSummary[]): MarketTopicSummary[] => {
  return defaultMarketTopics.map(topic => ({
    ...topic,
    totalGroups:
      topic.id === 'all'
        ? groups.length
        : groups.filter(group => (group.topic || resolveMarketTopic(group)) === topic.id).length
  }))
}

const topicCounts = computed(() => {
  return new Map<MarketTopicId, number>(
    marketTopics.value.map(topic => [topic.id, topic.totalGroups] as const)
  )
})

const topicVisibleMarketGroups = computed(() => {
  if (usePagedIndex.value && hasTopicIndex.value && !isSearchMode.value) return marketGroups.value
  if (selectedTopic.value === 'all') return marketGroups.value

  return marketGroups.value.filter(group => {
    return (group.topic || resolveMarketTopic(group)) === selectedTopic.value
  })
})

// 过滤后的市场分组
const filteredMarketGroups = computed(() => {
  const groups = topicVisibleMarketGroups.value
  if (!searchKeyword.value.trim()) {
    return groups
  }
  const keyword = searchKeyword.value.toLowerCase()
  return groups.filter(
    g =>
      g.name.toLowerCase().includes(keyword) ||
      (g.detail && g.detail.toLowerCase().includes(keyword))
  )
})

const pagedMarketGroups = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredMarketGroups.value.slice(start, start + pageSize.value)
})

const displayMarketGroups = computed(() => {
  if (usePagedIndex.value && hasTopicIndex.value && !isSearchMode.value) {
    return marketGroups.value
  }
  return pagedMarketGroups.value
})

const currentTopicTotal = computed(() => {
  if (isSearchMode.value || !usePagedIndex.value) return filteredMarketGroups.value.length
  return topicCounts.value.get(selectedTopic.value) ?? totalMarketGroups.value
})

// 详情模态框
const showDetailModal = ref(false)
const detailLoading = ref(false)
const currentDetailGroup = ref<EmojiGroup | null>(null)

// 加载市场数据（仅加载 metadata）
const loadMarketIndex = async () => {
  const baseUrl = getMarketBaseUrl()
  const indexUrl = `${baseUrl}/assets/market/index/index.json`
  const response = await fetch(indexUrl)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()
  return data
}

const getMarketTopicPageFileName = (topic: MarketTopicId, page: number) => {
  return topic === 'all' ? `page-${page}.json` : `${topic}-page-${page}.json`
}

const loadMarketPage = async (page: number, topic: MarketTopicId = selectedTopic.value) => {
  const baseUrl = getMarketBaseUrl()
  const pageUrl = `${baseUrl}/assets/market/index/${getMarketTopicPageFileName(topic, page)}`
  const response = await fetch(pageUrl)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()
  marketGroups.value = data.groups || []
  totalMarketGroups.value = data.totalGroups || marketGroups.value.length
}

const loadMarketMetadata = async () => {
  const baseUrl = getMarketBaseUrl()
  const metadataUrl = `${baseUrl}/assets/market/metadata.json`
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
  fullMarketGroups.value = data.groups || []
  marketGroups.value = fullMarketGroups.value
  totalMarketGroups.value = data.totalGroups || marketGroups.value.length
  marketTopics.value = Array.isArray(data.topics)
    ? data.topics
    : buildMarketTopicSummaries(fullMarketGroups.value)
  hasLoadedFullMarketMetadata.value = true
}

const loadMarketData = async () => {
  // 优化：防止重复请求（竞态条件）
  if (loading.value) return

  try {
    loading.value = true

    try {
      const indexData = await loadMarketIndex()
      usePagedIndex.value = true
      isSearchMode.value = false
      indexPageSize.value = indexData.pageSize || indexPageSize.value
      pageSize.value = indexPageSize.value
      totalMarketGroups.value = indexData.totalGroups || 0
      hasTopicIndex.value = Array.isArray(indexData.topics)
      marketTopics.value = hasTopicIndex.value ? indexData.topics : defaultMarketTopics
      marketMetadata.value = {
        version: indexData.version || '1.0',
        exportDate: indexData.exportDate || new Date().toISOString(),
        totalGroups: indexData.totalGroups || 0
      }
      currentPage.value = 1
      selectedTopic.value = 'all'
      fullMarketGroups.value = []
      if (hasTopicIndex.value) {
        await loadMarketPage(1, 'all')
        hasLoadedFullMarketMetadata.value = false
      } else {
        await loadMarketMetadata()
      }
    } catch (error) {
      // 回退到完整 metadata.json
      usePagedIndex.value = false
      isSearchMode.value = false
      hasTopicIndex.value = false
      await loadMarketMetadata()
    }
    currentPage.value = 1

    const successCount = totalMarketGroups.value || marketGroups.value.length
    message.success(t('loadMarketDataSuccess', { count: successCount }))
  } catch (error) {
    console.error('加载市场数据失败：', error)
    message.error(t('loadMarketDataFailed'))
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
    const baseUrl = getMarketBaseUrl()
    const groupUrl = `${baseUrl}/assets/market/group-${groupId}.json`
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
        name: e.name || t('unnamed'),
        url: e.url,
        displayUrl: e.displayUrl,
        width: e.width,
        height: e.height,
        groupId: groupData.id
      }))
    }

    // 优化：shallowRef 需要替换整个 Map 引用才能触发响应式更新
    const newCache = new Map(groupDetailsCache.value)
    newCache.set(groupId, detailGroup)
    groupDetailsCache.value = newCache

    return detailGroup
  } catch (error) {
    console.error('加载分组详情失败：', error)
    message.error(t('loadGroupDetailsFailed'))
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
      const confirm = await requestConfirmation(
        '',
        t('confirmOverwriteGroup', { name: groupData.name })
      )

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

    message.success(t('packageInstallSuccess', { name: groupData.name }))
  } catch (error) {
    console.error('安装表情包失败：', error)
    message.error(t('packageInstallFailed'))
  } finally {
    installingGroupIds.value.delete(groupId)
  }
}

watch([() => searchKeyword.value, () => selectedTopic.value], async ([keyword, topic]) => {
  if (!usePagedIndex.value || !hasTopicIndex.value) {
    marketGroups.value = fullMarketGroups.value
    totalMarketGroups.value = fullMarketGroups.value.length
    currentPage.value = 1
    return
  }

  const needsFullMetadata = Boolean(keyword && keyword.trim())
  if (needsFullMetadata) {
    currentPage.value = 1
    isSearchMode.value = true
    if (!hasLoadedFullMarketMetadata.value) {
      try {
        await loadMarketMetadata()
      } catch (error) {
        console.error('加载市场数据失败：', error)
      }
    } else {
      marketGroups.value = fullMarketGroups.value
      totalMarketGroups.value = fullMarketGroups.value.length
    }
    return
  }

  isSearchMode.value = false
  pageSize.value = indexPageSize.value
  try {
    if (currentPage.value === 1) {
      await loadMarketPage(1, topic)
    } else {
      currentPage.value = 1
    }
  } catch (error) {
    console.error('加载市场数据失败：', error)
  }
})

watch(
  () => filteredMarketGroups.value.length,
  total => {
    if (usePagedIndex.value && hasTopicIndex.value && !isSearchMode.value) return
    const maxPage = Math.max(1, Math.ceil(total / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  }
)

watch(
  () => currentPage.value,
  async page => {
    if (!usePagedIndex.value || !hasTopicIndex.value || isSearchMode.value) return
    try {
      loading.value = true
      await loadMarketPage(page, selectedTopic.value)
    } catch (error) {
      console.error('加载市场分页失败：', error)
      message.error(t('loadMarketDataFailed'))
    } finally {
      loading.value = false
    }
  }
)

onMounted(() => {
  loadMarketData()
})
</script>

<template>
  <div class="market-page h-full flex flex-col">
    <!-- 顶部操作栏 -->
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold dark:text-white">{{ t('cloudMarket') }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ t('cloudMarketDescription') }}
          <template v-if="marketMetadata">
            {{ t('totalPackages', [marketMetadata.totalGroups]) }}
          </template>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <a-button @click="loadMarketData" :loading="loading">{{ t('refresh') }}</a-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="mb-4 space-y-3">
      <a-segmented
        v-model:value="selectedTopic"
        :options="
          marketTopics.map(topic => ({
            value: topic.id,
            label: `${topic.label} (${topicCounts.get(topic.id) || 0})`
          }))
        "
      />
      <a-input-search
        v-model:value="searchKeyword"
        :placeholder="t('searchPackagesPlaceholder')"
        allow-clear
        size="large"
        class="max-w-md"
      />
    </div>

    <!-- 市场列表 -->
    <a-spin :spinning="loading" class="flex-1">
      <div v-if="filteredMarketGroups.length === 0 && !loading" class="text-center py-12">
        <p class="text-gray-400">
          {{ searchKeyword ? t('noMatchingPackages') : t('noAvailablePackages') }}
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="group in displayMarketGroups"
          :key="group.id"
          class="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow"
        >
          <!-- 表情包头部 -->
          <div class="flex items-start gap-3 mb-3">
            <template v-if="isImageUrl(normalizeImageUrl(group.icon))">
              <CachedImage
                :src="normalizeImageUrl(group.icon)"
                alt="icon"
                class="w-12 h-12 object-contain rounded"
              />
            </template>
            <span v-else class="text-3xl">{{ group.icon || '📁' }}</span>

            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-lg dark:text-white truncate">{{ group.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('emotesCount', { count: group.emojiCount }) }}
                <span v-if="group.isArchived" class="ml-2 text-xs text-orange-500">
                  {{ t('archived') }}
                </span>
              </p>
            </div>
          </div>

          <!-- 表情包描述 -->
          <p v-if="group.detail" class="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
            {{ group.detail }}
          </p>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2">
            <a-button @click="viewGroupDetails(group.id)" class="flex-1">
              {{ t('viewDetails') }}
            </a-button>
            <a-button v-if="installedGroupIds.has(group.id)" type="default" disabled class="flex-1">
              {{ t('installed') }}
            </a-button>
            <a-button
              v-else
              type="primary"
              :loading="installingGroupIds.has(group.id)"
              @click="installGroup(group.id)"
              class="flex-1"
            >
              {{ t('install') }}
            </a-button>
          </div>
        </div>
      </div>

      <div
        v-if="
          (usePagedIndex && hasTopicIndex && !isSearchMode && currentTopicTotal > pageSize) ||
          (!usePagedIndex && filteredMarketGroups.length > pageSize) ||
          (usePagedIndex && isSearchMode && filteredMarketGroups.length > pageSize)
        "
        class="mt-6 flex justify-center"
      >
        <a-pagination
          v-model:current="currentPage"
          v-model:pageSize="pageSize"
          :total="
            usePagedIndex && hasTopicIndex && !isSearchMode
              ? currentTopicTotal
              : filteredMarketGroups.length
          "
          :show-size-changer="!usePagedIndex || isSearchMode"
          :page-size-options="['12', '24', '48', '96']"
          show-less-items
        />
      </div>
    </a-spin>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="showDetailModal"
      :title="currentDetailGroup?.name || t('packageDetails')"
      width="80%"
      :footer="null"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentDetailGroup" class="space-y-4">
          <!-- 分组基本信息 -->
          <div class="flex items-start gap-3 pb-4 border-b dark:border-gray-700">
            <template v-if="isImageUrl(normalizeImageUrl(currentDetailGroup.icon))">
              <CachedImage
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
                {{ t('totalEmojisInPackage', { count: currentDetailGroup.emojis?.length || 0 }) }}
              </p>
              <p v-if="currentDetailGroup.detail" class="text-sm text-gray-600 dark:text-gray-300">
                {{ currentDetailGroup.detail }}
              </p>
            </div>
          </div>

          <!-- 表情网格 -->
          <div class="mt-4">
            <h4 class="font-semibold mb-3 dark:text-white">{{ t('emojiPreview') }}</h4>
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
              </div>
            </div>
            <div v-else class="text-center text-gray-400 py-8">
              {{ t('groupHasNoEmojisDetail') }}
            </div>
          </div>

          <!-- 底部操作按钮 -->
          <div class="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <a-button @click="closeDetailModal">{{ t('close') }}</a-button>
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
              {{ t('install') }}
            </a-button>
            <a-button v-else type="default" disabled>
              {{ t('installed') }}
            </a-button>
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
