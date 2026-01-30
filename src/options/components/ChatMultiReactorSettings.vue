<script setup lang="ts">
import { ref, computed, isRef, onMounted, watch, type Ref } from 'vue'
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons-vue'

import type { AppSettings } from '../../types/type'
import {
  REACTIONS,
  runBatchReaction,
  checkDailyLimit,
  type DailyLimitInfo
} from '../utils/linuxDoReaction'
import {
  fetchGroupList,
  fetchGroupDetail,
  addGroupMembers,
  type LinuxDoGroupSummary,
  type LinuxDoGroupDetail
} from '../utils/linuxDoGroup'

import SettingSwitch from './SettingSwitch.vue'

import CachedImage from '@/components/CachedImage.vue'
import { requestConfirmation } from '@/options/utils/confirmService'

// Discourse 表情数据结构
interface DiscourseEmoji {
  name: string
  tonable: boolean
  url: string
  group: string
  search_aliases?: string[]
}

interface DiscourseEmojisResponse {
  [group: string]: DiscourseEmoji[]
}

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()

const emit = defineEmits(['update:enableChatMultiReactor', 'update:chatMultiReactorEmojis'])

// 默认表情列表
const DEFAULT_EMOJI_LIST = [
  'wavy_dash',
  'distorted_face',
  'melting_face',
  'melon',
  'nerd_face',
  'face_savoring_food',
  'six',
  'five',
  'hug',
  'flushed_face',
  'pleading_face',
  'face_holding_back_tears',
  'disguised_face',
  'hot_face',
  'cold_face',
  'face_with_monocle',
  'clown_face',
  'poop'
]

// Discourse 站点 URL
const discourseUrl = ref('https://linux.do')

// 状态
const loading = ref(false)
const availableEmojis = ref<DiscourseEmoji[]>([])
const emojiGroups = ref<string[]>([])
const selectedGroup = ref<string>('all')
const searchQuery = ref('')
const errorMessage = ref('')

// Group manager state
const groupLoading = ref(false)
const groupError = ref('')
const groupList = ref<LinuxDoGroupSummary[]>([])
const selectedGroupName = ref('')
const manualGroupIdentifier = ref('')
const groupDetail = ref<LinuxDoGroupDetail | null>(null)
const groupDetailLoading = ref(false)
const groupNotifyUsers = ref(true)
const groupUsernames = ref('')
const groupActionStatus = ref('')
const isGroupRunning = ref(false)
const groupDetailCache = new Map<string, LinuxDoGroupDetail>()

const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    const s = props.settings
    if (isRef(s)) return (s.value && s.value[key]) ?? defaultValue
    return (s && (s as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

// Reaction Helper State
const reactionUsername = ref('')
const reactionCount = ref(10)
const reactionType = ref('distorted_face')
const dailyLimit = ref<DailyLimitInfo | null>(null)
const reactionStatus = ref('')
const isReacting = ref(false)

const checkLimit = async () => {
  reactionStatus.value = 'Checking limit...'
  dailyLimit.value = await checkDailyLimit()
  reactionStatus.value = dailyLimit.value
    ? `Ready. Logged in as ${dailyLimit.value.username}`
    : 'Failed to check limit (Not logged in?)'
}

const startReaction = async () => {
  if (!reactionUsername.value) return
  if (isReacting.value) return

  const rName = REACTIONS.find(r => r.id === reactionType.value)?.name || reactionType.value
  const confirmed = await requestConfirmation(
    '确认执行',
    `确定要给用户 ${reactionUsername.value} 的最近 ${reactionCount.value} 个帖子发送 "${rName}" 吗？`
  )
  if (!confirmed) return

  isReacting.value = true
  try {
    await runBatchReaction(
      reactionUsername.value,
      reactionCount.value,
      reactionType.value,
      (_current, _total, status) => {
        reactionStatus.value = status
      }
    )
  } finally {
    isReacting.value = false
    checkLimit()
  }
}

const loadGroups = async () => {
  groupLoading.value = true
  groupError.value = ''
  try {
    const list = await fetchGroupList()
    groupList.value = list
    if (!selectedGroupName.value && list.length > 0) {
      selectedGroupName.value = list[0].name
    }
  } catch (e) {
    groupError.value = `获取群组失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    groupLoading.value = false
  }
}

const loadGroupDetail = async (groupName: string) => {
  if (!groupName) {
    groupDetail.value = null
    return
  }
  if (groupDetailCache.has(groupName)) {
    groupDetail.value = groupDetailCache.get(groupName) || null
    return
  }
  groupDetailLoading.value = true
  try {
    const detail = await fetchGroupDetail(groupName)
    groupDetailCache.set(groupName, detail)
    groupDetail.value = detail
  } catch (e) {
    groupDetail.value = null
  } finally {
    groupDetailLoading.value = false
  }
}

const parseUsernames = (raw: string) =>
  raw
    .split(/[,\s]+/)
    .map(u => u.trim())
    .filter(Boolean)

const handleAddGroupMembers = async () => {
  if (isGroupRunning.value) return

  const usernames = parseUsernames(groupUsernames.value)
  if (!usernames.length) {
    groupActionStatus.value = '请输入用户名列表'
    return
  }

  const selected = groupList.value.find(g => g.name === selectedGroupName.value) || null
  const manual = manualGroupIdentifier.value.trim()
  const groupIdentifier = manual || (selected?.id ? String(selected.id) : selected?.name || '')
  if (!groupIdentifier) {
    groupActionStatus.value = '请选择群组或输入群组标识'
    return
  }

  const confirmed = await requestConfirmation(
    '确认添加成员',
    `确定要将 ${usernames.length} 个用户添加到群组 ${groupIdentifier} 吗？`
  )
  if (!confirmed) return

  isGroupRunning.value = true
  groupActionStatus.value = '正在提交...'
  try {
    const result = await addGroupMembers({
      groupIdentifier,
      usernames,
      notifyUsers: groupNotifyUsers.value
    })
    groupActionStatus.value = `✅ 添加成功：${JSON.stringify(result).slice(0, 200)}`
  } catch (e) {
    groupActionStatus.value = `❌ 添加失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    isGroupRunning.value = false
  }
}

// 当前选中的表情列表
const selectedEmojis = computed(() => {
  const list = getSetting('chatMultiReactorEmojis', []) as string[]
  return Array.isArray(list) && list.length > 0 ? list : [...DEFAULT_EMOJI_LIST]
})

// 过滤后的可用表情
const filteredEmojis = computed(() => {
  let emojis = availableEmojis.value

  // 按分组过滤
  if (selectedGroup.value !== 'all') {
    emojis = emojis.filter(e => e.group === selectedGroup.value)
  }

  // 按搜索词过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    emojis = emojis.filter(
      e =>
        e.name.toLowerCase().includes(query) ||
        e.search_aliases?.some(alias => alias.toLowerCase().includes(query))
    )
  }

  return emojis
})

// 通过页面代理获取数据
async function pageFetch<T>(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
  responseType: 'json' | 'text' = 'json'
): Promise<{ status: number; ok: boolean; data: T }> {
  const chromeAPI = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    throw new Error('Page fetch unavailable: chrome.runtime is not accessible')
  }

  return await new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(
      {
        type: 'LINUX_DO_PAGE_FETCH',
        options: {
          url,
          method: options?.method || 'GET',
          headers: options?.headers,
          body: options?.body,
          responseType
        }
      },
      (resp: { success: boolean; status?: number; ok?: boolean; data?: T; error?: string }) => {
        if (resp?.success) {
          resolve({
            status: resp.status || 200,
            ok: resp.ok !== false,
            data: resp.data as T
          })
          return
        }
        reject(new Error(resp?.error || `Page fetch failed: ${resp?.status || 'unknown'}`))
      }
    )
  })
}

// 从 Discourse 获取表情
const fetchEmojis = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const url = `${discourseUrl.value}/emojis.json`

    // 通过页面代理获取（绕过 CORS）
    const result = await pageFetch<DiscourseEmojisResponse>(url, {
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    if (!result.ok || !result.data) {
      throw new Error(`HTTP ${result.status}: Failed to fetch emojis`)
    }

    const data = result.data

    // 扁平化表情列表
    const allEmojis: DiscourseEmoji[] = []
    const groups: string[] = []

    for (const [groupName, emojis] of Object.entries(data)) {
      groups.push(groupName)
      for (const emoji of emojis) {
        allEmojis.push({ ...emoji, group: groupName })
      }
    }

    availableEmojis.value = allEmojis
    emojiGroups.value = groups
    console.log(
      `[ChatMultiReactorSettings] Loaded ${allEmojis.length} emojis from ${groups.length} groups`
    )
  } catch (e) {
    console.error('[ChatMultiReactorSettings] Failed to fetch emojis:', e)
    errorMessage.value = `获取表情失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
}

// 添加表情到选中列表
const addEmoji = (emojiName: string) => {
  if (!selectedEmojis.value.includes(emojiName)) {
    emit('update:chatMultiReactorEmojis', [...selectedEmojis.value, emojiName])
  }
}

// 从选中列表移除表情
const removeEmoji = (emojiName: string) => {
  const newList = selectedEmojis.value.filter(e => e !== emojiName)
  emit('update:chatMultiReactorEmojis', newList)
}

// 检查表情是否已选中
const isSelected = (emojiName: string) => {
  return selectedEmojis.value.includes(emojiName)
}

// 切换表情选中状态
const toggleEmoji = (emojiName: string) => {
  if (isSelected(emojiName)) {
    removeEmoji(emojiName)
  } else {
    addEmoji(emojiName)
  }
}

// 重置为默认
const resetToDefault = () => {
  emit('update:chatMultiReactorEmojis', [...DEFAULT_EMOJI_LIST])
}

// 清空选中
const clearAll = () => {
  emit('update:chatMultiReactorEmojis', [])
}

// 获取表情 URL
const getEmojiUrl = (emojiName: string) => {
  const emoji = availableEmojis.value.find(e => e.name === emojiName)
  if (emoji?.url) {
    // 如果是相对 URL，补全为绝对 URL
    if (emoji.url.startsWith('/')) {
      return `${discourseUrl.value}${emoji.url}`
    }
    return emoji.url
  }
  // 回退到 Discourse 默认路径
  return `${discourseUrl.value}/images/emoji/twitter/${emojiName}.png`
}

// 组件挂载时尝试获取表情
onMounted(() => {
  // 如果启用了功能，自动获取表情
  if (getSetting('enableChatMultiReactor', false)) {
    fetchEmojis()
  }

  // 自动加载 linux.do 群组列表（通过页面代理请求）
  loadGroups()
})

watch(
  () => selectedGroupName.value,
  name => {
    loadGroupDetail(name)
  }
)
</script>

<template>
  <div class="space-y-6">
    <!-- 功能开关 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <SettingSwitch
        :model-value="getSetting('enableChatMultiReactor', false)"
        @update:model-value="emit('update:enableChatMultiReactor', $event)"
        label="启用聊天多表情反应"
        description="在 Discourse 聊天消息旁添加按钮，一键发送多个表情反应"
      />
    </div>

    <!-- 用户点赞助手 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <h3 class="text-md font-semibold dark:text-white mb-4">用户点赞助手</h3>

      <div class="space-y-4">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="flex-1 min-w-[200px]">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">目标用户名</div>
            <a-input v-model:value="reactionUsername" placeholder="Target Username" />
          </div>

          <div class="w-24">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">数量</div>
            <a-input-number v-model:value="reactionCount" :min="1" :max="100" class="w-full" />
          </div>

          <div class="w-40">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">表情</div>
            <a-select v-model:value="reactionType" class="w-full">
              <a-select-option v-for="r in REACTIONS" :key="r.id" :value="r.id">
                {{ r.name }}
              </a-select-option>
            </a-select>
          </div>

          <a-button
            type="primary"
            :loading="isReacting"
            @click="startReaction"
            :disabled="!reactionUsername"
          >
            执行
          </a-button>
        </div>

        <div
          class="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 p-3 rounded text-sm"
        >
          <div class="flex items-center gap-4">
            <a-button size="small" @click="checkLimit">检查额度</a-button>
            <div v-if="dailyLimit">
              <span class="text-gray-500 dark:text-gray-400">剩余额度：</span>
              <span
                :class="
                  dailyLimit.remaining > 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'
                "
              >
                {{ dailyLimit.remaining }}
              </span>
              <span class="text-gray-400 mx-1">/</span>
              <span class="text-gray-500 dark:text-gray-400">{{ dailyLimit.limit }}</span>
              <span class="text-gray-400 text-xs ml-2">({{ dailyLimit.username }})</span>
            </div>
            <div v-else class="text-gray-500 dark:text-gray-400">点击检查额度以查看剩余次数</div>
          </div>
        </div>

        <div
          v-if="reactionStatus"
          class="text-xs font-mono bg-black text-green-400 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap"
        >
          > {{ reactionStatus }}
        </div>
      </div>
    </div>

    <!-- 群组成员管理 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="text-md font-semibold dark:text-white">群组成员管理</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            从 linux.do 群组列表选择并批量添加成员
          </p>
        </div>
        <a-button size="small" :loading="groupLoading" @click="loadGroups">加载群组</a-button>
      </div>

      <a-alert
        v-if="groupError"
        :message="groupError"
        type="error"
        class="mb-4"
        closable
        @close="groupError = ''"
      />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">选择群组</div>
          <a-select
            v-model:value="selectedGroupName"
            placeholder="选择群组"
            class="w-full"
            :options="
              groupList.map(g => ({
                value: g.name,
                label: `${g.full_name || g.name} (${g.user_count || 0})`
              }))
            "
          />
        </div>

        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">手动群组标识（可选）</div>
          <a-input
            v-model:value="manualGroupIdentifier"
            placeholder="群组 ID 或名称（优先于选择）"
          />
        </div>
      </div>

      <div class="mt-4">
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">用户名列表</div>
        <a-textarea
          v-model:value="groupUsernames"
          :rows="3"
          placeholder="user1 user2 user3 或 user1,user2,user3"
        />
      </div>

      <div class="mt-4 flex items-center gap-3">
        <a-checkbox v-model:checked="groupNotifyUsers">通知用户</a-checkbox>
        <a-button type="primary" :loading="isGroupRunning" @click="handleAddGroupMembers">
          添加成员
        </a-button>
      </div>

      <div v-if="groupDetail || groupDetailLoading" class="mt-4 text-xs text-gray-500">
        <a-spin v-if="groupDetailLoading" size="small" />
        <span v-else>
          群组信息：{{ groupDetail?.group?.full_name || groupDetail?.group?.name }}
          <span class="mx-1">•</span>
          成员数 {{ groupDetail?.group?.user_count || 0 }}
          <span class="mx-1">•</span>
          {{ groupDetail?.group?.is_group_owner ? '你是群主' : '非群主' }}
        </span>
      </div>

      <div
        v-if="groupActionStatus"
        class="mt-3 text-xs font-mono bg-black text-green-400 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap"
      >
        > {{ groupActionStatus }}
      </div>
    </div>

    <!-- 表情配置（仅在启用时显示） -->
    <template v-if="getSetting('enableChatMultiReactor', false)">
      <!-- 当前选中的表情 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div
          class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
        >
          <div>
            <h3 class="text-md font-semibold dark:text-white">已选表情</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              点击发送按钮时将依次发送这些表情（共 {{ selectedEmojis.length }} 个）
            </p>
          </div>
          <div class="flex gap-2">
            <a-button size="small" @click="resetToDefault">重置默认</a-button>
            <a-button size="small" danger @click="clearAll">清空</a-button>
          </div>
        </div>
        <div class="p-4">
          <div v-if="selectedEmojis.length === 0" class="text-center text-gray-500 py-4">
            暂无选中的表情，请从下方列表添加
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <a-tag
              v-for="(emoji, index) in selectedEmojis"
              :key="emoji"
              closable
              @close="removeEmoji(emoji)"
              class="flex items-center gap-1 px-2 py-1"
            >
              <span class="text-gray-500 text-xs mr-1">{{ index + 1 }}.</span>
              <CachedImage :src="getEmojiUrl(emoji)" :alt="emoji" class="w-5 h-5" />
              <span class="text-sm">{{ emoji }}</span>
            </a-tag>
          </div>
        </div>
      </div>

      <!-- 从 Discourse 获取表情 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-md font-semibold dark:text-white">可用表情</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                从 Discourse 站点获取可用表情列表
              </p>
            </div>
            <div class="flex gap-2 items-center">
              <a-input
                v-model:value="discourseUrl"
                placeholder="Discourse URL"
                style="width: 200px"
                size="small"
              />
              <a-button type="primary" size="small" :loading="loading" @click="fetchEmojis">
                <template #icon><ReloadOutlined /></template>
                获取表情
              </a-button>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <a-alert
          v-if="errorMessage"
          :message="errorMessage"
          type="error"
          class="m-4"
          closable
          @close="errorMessage = ''"
        />

        <!-- 过滤和搜索 -->
        <div
          v-if="availableEmojis.length > 0"
          class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-4"
        >
          <a-select v-model:value="selectedGroup" style="width: 150px" size="small">
            <a-select-option value="all">全部分组</a-select-option>
            <a-select-option v-for="group in emojiGroups" :key="group" :value="group">
              {{ group }}
            </a-select-option>
          </a-select>
          <a-input-search
            v-model:value="searchQuery"
            placeholder="搜索表情..."
            style="width: 200px"
            size="small"
            allow-clear
          />
          <span class="text-sm text-gray-500 self-center">
            显示 {{ filteredEmojis.length }} / {{ availableEmojis.length }} 个表情
          </span>
        </div>

        <!-- 表情网格 -->
        <div class="p-4 max-h-96 overflow-y-auto">
          <div v-if="loading" class="text-center py-8">
            <a-spin />
            <p class="mt-2 text-gray-500">正在获取表情...</p>
          </div>
          <div v-else-if="availableEmojis.length === 0" class="text-center py-8 text-gray-500">
            点击"获取表情"按钮从 Discourse 站点加载可用表情
          </div>
          <div v-else-if="filteredEmojis.length === 0" class="text-center py-8 text-gray-500">
            没有找到匹配的表情
          </div>
          <div v-else class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
            <div
              v-for="emoji in filteredEmojis"
              :key="emoji.name"
              class="relative cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="{ 'bg-blue-100 dark:bg-blue-900': isSelected(emoji.name) }"
              :title="emoji.name"
              @click="toggleEmoji(emoji.name)"
            >
              <CachedImage
                :src="emoji.url.startsWith('/') ? `${discourseUrl}${emoji.url}` : emoji.url"
                :alt="emoji.name"
                class="w-8 h-8 object-contain"
                loading="lazy"
              />
              <CheckOutlined
                v-if="isSelected(emoji.name)"
                class="absolute -top-1 -right-1 text-blue-500 bg-white dark:bg-gray-800 rounded-full text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
