<script setup lang="ts">
import { ref, computed, isRef, type Ref } from 'vue'
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import type { AppSettings, ScheduledLikeTask } from '../../types/type'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const emit = defineEmits(['update:enableScheduledLikes', 'update:scheduledLikeTasks'])

const getSetting = <K extends keyof AppSettings>(key: K, defaultValue: AppSettings[K]) => {
  try {
    if (isRef(props.settings))
      return (props.settings.value && props.settings.value[key]) ?? defaultValue
    return (props.settings && (props.settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

const enableScheduledLikes = computed(() => getSetting('enableScheduledLikes', false))
const tasks = computed(() => getSetting('scheduledLikeTasks', []) as ScheduledLikeTask[])

// 新任务表单
const showAddModal = ref(false)
const newTask = ref({
  username: '',
  baseUrl: 'https://linux.do',
  intervalMinutes: 60,
  maxLikesPerRun: 5
})

const handleToggleEnabled = (value: boolean | string | number) => {
  emit('update:enableScheduledLikes', Boolean(value))
}

const generateId = () => {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const handleAddTask = () => {
  if (!newTask.value.username.trim()) {
    message.error('请输入用户名')
    return
  }
  if (!newTask.value.baseUrl.trim()) {
    message.error('请输入站点地址')
    return
  }
  if (newTask.value.intervalMinutes < 10) {
    message.error('执行间隔至少为 10 分钟')
    return
  }

  const now = Date.now()
  const task: ScheduledLikeTask = {
    id: generateId(),
    username: newTask.value.username.trim(),
    baseUrl: newTask.value.baseUrl.trim().replace(/\/$/, ''),
    enabled: true,
    intervalMinutes: newTask.value.intervalMinutes,
    maxLikesPerRun: newTask.value.maxLikesPerRun,
    nextRunAt: now + newTask.value.intervalMinutes * 60 * 1000,
    totalLikes: 0,
    createdAt: now,
    updatedAt: now
  }

  const updatedTasks = [...tasks.value, task]
  emit('update:scheduledLikeTasks', updatedTasks)

  // 重置表单
  newTask.value = {
    username: '',
    baseUrl: 'https://linux.do',
    intervalMinutes: 60,
    maxLikesPerRun: 5
  }
  showAddModal.value = false
  message.success('任务已添加')
}

const handleDeleteTask = (taskId: string) => {
  const updatedTasks = tasks.value.filter(t => t.id !== taskId)
  emit('update:scheduledLikeTasks', updatedTasks)
  message.success('任务已删除')
}

const handleToggleTask = (taskId: string) => {
  const updatedTasks = tasks.value.map(t => {
    if (t.id === taskId) {
      const now = Date.now()
      return {
        ...t,
        enabled: !t.enabled,
        nextRunAt: !t.enabled ? now + t.intervalMinutes * 60 * 1000 : t.nextRunAt,
        updatedAt: now
      }
    }
    return t
  })
  emit('update:scheduledLikeTasks', updatedTasks)
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
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold dark:text-white">计划任务 - 定时点赞</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            自动为指定用户的帖子点赞（试验性功能）
          </p>
        </div>
        <a-switch :checked="enableScheduledLikes" @change="handleToggleEnabled" />
      </div>
    </div>

    <div v-if="enableScheduledLikes" class="p-6 space-y-4">
      <!-- 警告提示 -->
      <a-alert
        type="warning"
        show-icon
        message="注意事项"
        description="此功能为试验性功能，请谨慎使用。频繁点赞可能违反站点规则，请确保遵守相关使用条款。"
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
                <span class="font-medium dark:text-white">@{{ task.username }}</span>
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
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ task.baseUrl }}
              </div>
              <div
                class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                <div>
                  <span class="text-gray-400">间隔:</span>
                  {{ formatInterval(task.intervalMinutes) }}
                </div>
                <div>
                  <span class="text-gray-400">每次最多:</span>
                  {{ task.maxLikesPerRun }} 个
                </div>
                <div>
                  <span class="text-gray-400">累计点赞:</span>
                  {{ task.totalLikes }}
                </div>
                <div>
                  <span class="text-gray-400">下次执行:</span>
                  {{ formatTime(task.nextRunAt) }}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-4">
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

      <!-- 空状态 -->
      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>暂无计划任务</p>
        <p class="text-sm mt-1">点击下方按钮添加新任务</p>
      </div>

      <!-- 添加任务按钮 -->
      <a-button type="dashed" block @click="showAddModal = true">
        <template #icon>
          <PlusOutlined />
        </template>
        添加任务
      </a-button>

      <!-- 添加任务弹窗 -->
      <a-modal
        v-model:open="showAddModal"
        title="添加定时点赞任务"
        ok-text="添加"
        cancel-text="取消"
        @ok="handleAddTask"
      >
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-white">目标用户名</label>
            <a-input v-model:value="newTask.username" placeholder="输入 Discourse 用户名" />
            <p class="text-xs text-gray-500 mt-1">将自动为该用户的最新帖子点赞</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-white">站点地址</label>
            <a-input v-model:value="newTask.baseUrl" placeholder="https://linux.do" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-white">执行间隔（分钟）</label>
            <a-input-number
              v-model:value="newTask.intervalMinutes"
              :min="10"
              :max="1440"
              class="w-full"
            />
            <p class="text-xs text-gray-500 mt-1">最小 10 分钟，最大 24 小时</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-white">每次最多点赞数</label>
            <a-input-number
              v-model:value="newTask.maxLikesPerRun"
              :min="1"
              :max="20"
              class="w-full"
            />
            <p class="text-xs text-gray-500 mt-1">每次执行最多点赞的帖子数量</p>
          </div>
        </div>
      </a-modal>
    </div>
  </div>
</template>
