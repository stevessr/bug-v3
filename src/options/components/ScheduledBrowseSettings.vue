<script setup lang="ts">
import { ref, computed, isRef, type Ref } from 'vue'
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import type { AppSettings, ScheduledBrowseTask, BrowseStrategy } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const emit = defineEmits(['update:enableScheduledBrowse', 'update:scheduledBrowseTasks'])

const getSetting = <K extends keyof AppSettings>(key: K, defaultValue: AppSettings[K]) => {
  try {
    if (isRef(props.settings))
      return (props.settings.value && props.settings.value[key]) ?? defaultValue
    return (props.settings && (props.settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

const enableScheduledBrowse = computed(() => getSetting('enableScheduledBrowse', false))
const tasks = computed(() => getSetting('scheduledBrowseTasks', []) as ScheduledBrowseTask[])

const showAddModal = ref(false)
const showEditModal = ref(false)
const editingTaskId = ref<string | null>(null)

const strategyOptions = [
  { label: '最新 (Latest)', value: 'latest' },
  { label: '新话题 (New)', value: 'new' },
  { label: '未读 (Unread)', value: 'unread' },
  { label: '热门 (Top)', value: 'top' }
]

const defaultNewTask = {
  name: '',
  baseUrl: 'https://linux.do',
  intervalMinutes: 30,
  browseStrategy: 'latest' as BrowseStrategy,
  minTopicsPerRun: 3,
  maxTopicsPerRun: 10,
  minReadTime: 5,
  maxReadTime: 30,
  enableRandomLike: true,
  likeChance: 30,
  maxLikesPerRun: 5,
  minDelayBetweenTopics: 3,
  maxDelayBetweenTopics: 10
}

const newTask = ref({ ...defaultNewTask })

const handleToggleEnabled = (value: boolean | string | number) => {
  emit('update:enableScheduledBrowse', Boolean(value))
}

const generateId = () => {
  return `browse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const validateTask = (task: typeof newTask.value): string | null => {
  if (!task.name.trim()) return '请输入任务名称'
  if (!task.baseUrl.trim()) return '请输入站点地址'
  if (task.intervalMinutes < 5) return '执行间隔至少为 5 分钟'
  if (task.minTopicsPerRun < 1) return '最少浏览话题数至少为 1'
  if (task.maxTopicsPerRun < task.minTopicsPerRun) return '最大话题数不能小于最小话题数'
  if (task.minReadTime < 1) return '最小阅读时间至少为 1 秒'
  if (task.maxReadTime < task.minReadTime) return '最大阅读时间不能小于最小阅读时间'
  if (task.enableRandomLike) {
    if (task.likeChance < 0 || task.likeChance > 100) return '点赞概率需在 0-100 之间'
    if (task.maxLikesPerRun < 1) return '每次最多点赞数至少为 1'
  }
  if (task.minDelayBetweenTopics < 1) return '最小延迟至少为 1 秒'
  if (task.maxDelayBetweenTopics < task.minDelayBetweenTopics) return '最大延迟不能小于最小延迟'
  return null
}

const handleAddTask = () => {
  const error = validateTask(newTask.value)
  if (error) {
    message.error(error)
    return
  }

  const now = Date.now()
  const task: ScheduledBrowseTask = {
    id: generateId(),
    name: newTask.value.name.trim(),
    baseUrl: newTask.value.baseUrl.trim().replace(/\/$/, ''),
    enabled: true,
    intervalMinutes: newTask.value.intervalMinutes,
    browseStrategy: newTask.value.browseStrategy,
    minTopicsPerRun: newTask.value.minTopicsPerRun,
    maxTopicsPerRun: newTask.value.maxTopicsPerRun,
    minReadTime: newTask.value.minReadTime,
    maxReadTime: newTask.value.maxReadTime,
    enableRandomLike: newTask.value.enableRandomLike,
    likeChance: newTask.value.likeChance,
    maxLikesPerRun: newTask.value.maxLikesPerRun,
    minDelayBetweenTopics: newTask.value.minDelayBetweenTopics,
    maxDelayBetweenTopics: newTask.value.maxDelayBetweenTopics,
    nextRunAt: now + newTask.value.intervalMinutes * 60 * 1000,
    totalTopicsRead: 0,
    totalLikes: 0,
    createdAt: now,
    updatedAt: now
  }

  emit('update:scheduledBrowseTasks', [...tasks.value, task])
  newTask.value = { ...defaultNewTask }
  showAddModal.value = false
  message.success('任务已添加')
}

const handleEditTask = (taskId: string) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  editingTaskId.value = taskId
  newTask.value = {
    name: task.name,
    baseUrl: task.baseUrl,
    intervalMinutes: task.intervalMinutes,
    browseStrategy: task.browseStrategy,
    minTopicsPerRun: task.minTopicsPerRun,
    maxTopicsPerRun: task.maxTopicsPerRun,
    minReadTime: task.minReadTime,
    maxReadTime: task.maxReadTime,
    enableRandomLike: task.enableRandomLike,
    likeChance: task.likeChance,
    maxLikesPerRun: task.maxLikesPerRun,
    minDelayBetweenTopics: task.minDelayBetweenTopics,
    maxDelayBetweenTopics: task.maxDelayBetweenTopics
  }
  showEditModal.value = true
}

const handleSaveEdit = () => {
  if (!editingTaskId.value) return

  const error = validateTask(newTask.value)
  if (error) {
    message.error(error)
    return
  }

  const now = Date.now()
  const updatedTasks = tasks.value.map(t => {
    if (t.id === editingTaskId.value) {
      return {
        ...t,
        name: newTask.value.name.trim(),
        baseUrl: newTask.value.baseUrl.trim().replace(/\/$/, ''),
        intervalMinutes: newTask.value.intervalMinutes,
        browseStrategy: newTask.value.browseStrategy,
        minTopicsPerRun: newTask.value.minTopicsPerRun,
        maxTopicsPerRun: newTask.value.maxTopicsPerRun,
        minReadTime: newTask.value.minReadTime,
        maxReadTime: newTask.value.maxReadTime,
        enableRandomLike: newTask.value.enableRandomLike,
        likeChance: newTask.value.likeChance,
        maxLikesPerRun: newTask.value.maxLikesPerRun,
        minDelayBetweenTopics: newTask.value.minDelayBetweenTopics,
        maxDelayBetweenTopics: newTask.value.maxDelayBetweenTopics,
        updatedAt: now
      }
    }
    return t
  })

  emit('update:scheduledBrowseTasks', updatedTasks)
  showEditModal.value = false
  editingTaskId.value = null
  newTask.value = { ...defaultNewTask }
  message.success('任务已更新')
}

const handleDeleteTask = (taskId: string) => {
  emit(
    'update:scheduledBrowseTasks',
    tasks.value.filter(t => t.id !== taskId)
  )
  message.success('任务已删除')
}

const handleToggleTask = (taskId: string) => {
  const now = Date.now()
  const updatedTasks = tasks.value.map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        enabled: !t.enabled,
        nextRunAt: !t.enabled ? now + t.intervalMinutes * 60 * 1000 : t.nextRunAt,
        updatedAt: now
      }
    }
    return t
  })
  emit('update:scheduledBrowseTasks', updatedTasks)
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatInterval = (minutes: number) => {
  if (minutes < 60) return `${minutes} 分钟`
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} 小时`
  return `${(minutes / 1440).toFixed(1)} 天`
}

const getStrategyLabel = (strategy: BrowseStrategy) => {
  const option = strategyOptions.find(o => o.value === strategy)
  return option?.label || strategy
}

const handleModalClose = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingTaskId.value = null
  newTask.value = { ...defaultNewTask }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold dark:text-white">计划任务 - 自动浏览</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            自动浏览话题并可选随机点赞（试验性功能）
          </p>
        </div>
        <a-switch :checked="enableScheduledBrowse" @change="handleToggleEnabled" />
      </div>
    </div>

    <div v-if="enableScheduledBrowse" class="p-6 space-y-4">
      <a-alert
        type="warning"
        show-icon
        message="注意事项"
        description="此功能模拟用户浏览行为，请合理设置间隔和阅读时间，避免对服务器造成压力。过于频繁的操作可能违反站点规则。"
        class="mb-4"
      />

      <!-- 任务列表 -->
      <div v-if="tasks.length > 0" class="space-y-3">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          :class="{ 'opacity-50': !task.enabled }"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium dark:text-white">{{ task.name }}</span>
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="
                    task.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  "
                >
                  {{ task.enabled ? '运行中' : '已暂停' }}
                </span>
                <span
                  class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                >
                  {{ getStrategyLabel(task.browseStrategy) }}
                </span>
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ task.baseUrl }}
              </div>
              <div
                class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                <div>
                  <span class="text-gray-400">间隔：</span>
                  {{ formatInterval(task.intervalMinutes) }}
                </div>
                <div>
                  <span class="text-gray-400">话题数：</span>
                  {{ task.minTopicsPerRun }}-{{ task.maxTopicsPerRun }}
                </div>
                <div>
                  <span class="text-gray-400">累计浏览：</span>
                  {{ task.totalTopicsRead }}
                </div>
                <div>
                  <span class="text-gray-400">累计点赞：</span>
                  {{ task.totalLikes }}
                </div>
              </div>
              <div class="text-xs text-gray-400 mt-1">
                下次执行：{{ formatTime(task.nextRunAt) }}
              </div>
            </div>
            <div class="flex items-center gap-1 ml-4">
              <a-button type="text" title="编辑任务" @click="handleEditTask(task.id)">
                <template #icon>
                  <SettingOutlined />
                </template>
              </a-button>
              <a-button
                type="text"
                :title="task.enabled ? '暂停任务' : '启动任务'"
                @click="handleToggleTask(task.id)"
              >
                <template #icon>
                  <PauseCircleOutlined v-if="task.enabled" />
                  <PlayCircleOutlined v-else />
                </template>
              </a-button>
              <a-popconfirm
                title="确定要删除这个任务吗？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDeleteTask(task.id)"
              >
                <a-button type="text" danger title="删除任务">
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>暂无自动浏览任务</p>
        <p class="text-sm mt-1">点击下方按钮添加新任务</p>
      </div>

      <a-button type="dashed" block @click="showAddModal = true">
        <template #icon>
          <PlusOutlined />
        </template>
        添加自动浏览任务
      </a-button>

      <!-- 添加/编辑任务弹窗 -->
      <a-modal
        :open="showAddModal || showEditModal"
        :title="showEditModal ? '编辑自动浏览任务' : '添加自动浏览任务'"
        :ok-text="showEditModal ? '保存' : '添加'"
        cancel-text="取消"
        width="600px"
        @ok="showEditModal ? handleSaveEdit() : handleAddTask()"
        @cancel="handleModalClose"
      >
        <div class="space-y-4 max-h-96 overflow-y-auto pr-2">
          <!-- 基本信息 -->
          <div class="border-b border-gray-200 dark:border-gray-600 pb-4">
            <h4 class="text-sm font-medium mb-3 dark:text-white">基本信息</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1 dark:text-white">任务名称</label>
                <a-input v-model:value="newTask.name" placeholder="如: LinuxDo 自动浏览" />
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">站点地址</label>
                <a-input v-model:value="newTask.baseUrl" placeholder="https://linux.do" />
              </div>
            </div>
          </div>

          <!-- 浏览设置 -->
          <div class="border-b border-gray-200 dark:border-gray-600 pb-4">
            <h4 class="text-sm font-medium mb-3 dark:text-white">浏览设置</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1 dark:text-white">浏览策略</label>
                <a-select v-model:value="newTask.browseStrategy" class="w-full">
                  <a-select-option
                    v-for="opt in strategyOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </a-select-option>
                </a-select>
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">执行间隔（分钟）</label>
                <a-input-number
                  v-model:value="newTask.intervalMinutes"
                  :min="5"
                  :max="1440"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">每次浏览话题数（最小）</label>
                <a-input-number
                  v-model:value="newTask.minTopicsPerRun"
                  :min="1"
                  :max="50"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">每次浏览话题数（最大）</label>
                <a-input-number
                  v-model:value="newTask.maxTopicsPerRun"
                  :min="1"
                  :max="50"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">阅读时间（最小秒）</label>
                <a-input-number
                  v-model:value="newTask.minReadTime"
                  :min="1"
                  :max="300"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">阅读时间（最大秒）</label>
                <a-input-number
                  v-model:value="newTask.maxReadTime"
                  :min="1"
                  :max="300"
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- 点赞设置 -->
          <div class="border-b border-gray-200 dark:border-gray-600 pb-4">
            <h4 class="text-sm font-medium mb-3 dark:text-white">点赞设置</h4>
            <div class="flex items-center gap-4 mb-3">
              <a-switch v-model:checked="newTask.enableRandomLike" />
              <span class="text-sm dark:text-white">启用随机点赞</span>
            </div>
            <div v-if="newTask.enableRandomLike" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1 dark:text-white">点赞概率 (%)</label>
                <a-slider v-model:value="newTask.likeChance" :min="0" :max="100" />
                <span class="text-xs text-gray-500">{{ newTask.likeChance }}%</span>
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">每次最多点赞数</label>
                <a-input-number
                  v-model:value="newTask.maxLikesPerRun"
                  :min="1"
                  :max="50"
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- 延迟设置 -->
          <div>
            <h4 class="text-sm font-medium mb-3 dark:text-white">延迟设置</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1 dark:text-white">话题间最小延迟（秒）</label>
                <a-input-number
                  v-model:value="newTask.minDelayBetweenTopics"
                  :min="1"
                  :max="60"
                  class="w-full"
                />
              </div>
              <div>
                <label class="block text-sm mb-1 dark:text-white">话题间最大延迟（秒）</label>
                <a-input-number
                  v-model:value="newTask.maxDelayBetweenTopics"
                  :min="1"
                  :max="120"
                  class="w-full"
                />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              延迟将在最小和最大值之间随机选择，以模拟真实用户行为
            </p>
          </div>
        </div>
      </a-modal>
    </div>
  </div>
</template>
