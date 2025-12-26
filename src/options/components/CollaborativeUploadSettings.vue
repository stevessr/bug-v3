<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

import {
  CollaborativeUploadClient,
  startWorkerMode,
  stopWorkerMode,
  getWorkerClient,
  type ConnectionStatus,
  type ServerStats,
  type UploadProgress
} from '@/utils/collaborativeUpload'

// ==================== 状态 ====================

const serverUrl = ref('ws://localhost:9527')
const isWorkerMode = ref(false)
const connectionStatus = ref<ConnectionStatus | null>(null)
const serverStats = ref<ServerStats | null>(null)
const workerStats = ref({ completed: 0, failed: 0, totalBytes: 0 })
const uploadProgress = ref<UploadProgress | null>(null)
const currentTask = ref<{ filename: string; status: string } | null>(null)

// 主控端状态
const isMasterMode = ref(false)
const masterClient = ref<CollaborativeUploadClient | null>(null)
const selectedFiles = ref<File[]>([])
const isUploading = ref(false)
const uploadResults = ref<
  Array<{ filename: string; success: boolean; url?: string; error?: string }>
>([])

// 刷新定时器
let statsRefreshTimer: ReturnType<typeof setInterval> | null = null

// ==================== 计算属性 ====================

const isConnected = computed(() => connectionStatus.value?.connected ?? false)

const statusText = computed(() => {
  if (!connectionStatus.value) return '未连接'
  if (!connectionStatus.value.connected) return '连接中...'
  if (connectionStatus.value.role === 'worker') {
    return `工作者模式 (ID: ${connectionStatus.value.workerId?.slice(0, 8)}...)`
  }
  return `主控模式 (会话：${connectionStatus.value.sessionId?.slice(0, 8)}...)`
})

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const taskStatusText = computed(() => {
  if (!currentTask.value) return ''
  switch (currentTask.value.status) {
    case 'processing':
      return '处理中'
    case 'waiting':
      return '等待中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return ''
  }
})

const taskStatusColor = computed(() => {
  if (!currentTask.value) return ''
  switch (currentTask.value.status) {
    case 'processing':
      return 'text-blue-600'
    case 'waiting':
      return 'text-orange-600'
    case 'completed':
      return 'text-green-600'
    case 'failed':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
})

// ==================== 工作者模式 ====================

async function toggleWorkerMode() {
  if (isWorkerMode.value) {
    // 停止工作者模式
    stopWorkerMode()
    isWorkerMode.value = false
    connectionStatus.value = null
    serverStats.value = null
    currentTask.value = null
    stopStatsRefresh()
  } else {
    // 启动工作者模式
    try {
      await startWorkerMode(
        serverUrl.value,
        status => {
          connectionStatus.value = status
        },
        stats => {
          workerStats.value = stats
        },
        task => {
          currentTask.value = task
          // 2 秒后清除任务状态（如果已完成/失败）
          if (task && (task.status === 'completed' || task.status === 'failed')) {
            setTimeout(() => {
              if (currentTask.value?.filename === task.filename) {
                currentTask.value = null
              }
            }, 2000)
          }
        }
      )
      isWorkerMode.value = true

      // 开始定时刷新状态
      startStatsRefresh()
    } catch (error) {
      console.error('Failed to start worker mode:', error)
      alert('连接服务器失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }
}

function startStatsRefresh() {
  statsRefreshTimer = setInterval(() => {
    const client = getWorkerClient()
    if (client) {
      client.requestStats()
      serverStats.value = client.serverStats
    }
  }, 2000)
}

function stopStatsRefresh() {
  if (statsRefreshTimer) {
    clearInterval(statsRefreshTimer)
    statsRefreshTimer = null
  }
}

// ==================== 主控模式 ====================

async function startMasterMode() {
  if (isMasterMode.value && masterClient.value) {
    masterClient.value.disconnect()
    masterClient.value = null
    isMasterMode.value = false
    connectionStatus.value = null
    return
  }

  try {
    masterClient.value = new CollaborativeUploadClient({
      serverUrl: serverUrl.value,
      role: 'master',
      onStatusChange: status => {
        connectionStatus.value = status
      },
      onProgress: progress => {
        uploadProgress.value = progress
      }
    })

    await masterClient.value.connect()
    isMasterMode.value = true
    serverStats.value = masterClient.value.serverStats
  } catch (error) {
    console.error('Failed to start master mode:', error)
    alert('连接服务器失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    selectedFiles.value = Array.from(input.files)
  }
}

async function startCollaborativeUpload() {
  if (!masterClient.value || selectedFiles.value.length === 0) return

  isUploading.value = true
  uploadProgress.value = { completed: 0, failed: 0, total: selectedFiles.value.length }
  uploadResults.value = []

  try {
    const results = await masterClient.value.submitTasks(selectedFiles.value)
    uploadResults.value = results
  } catch (error) {
    console.error('Collaborative upload failed:', error)
    alert('上传失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    isUploading.value = false
  }
}

// ==================== 生命周期 ====================

onMounted(() => {
  // 检查是否有保存的服务器地址
  const saved = localStorage.getItem('collaborative-upload-server')
  if (saved) {
    serverUrl.value = saved
  }
})

onUnmounted(() => {
  stopStatsRefresh()
  if (isWorkerMode.value) {
    stopWorkerMode()
  }
  if (masterClient.value) {
    masterClient.value.disconnect()
  }
})

function saveServerUrl() {
  localStorage.setItem('collaborative-upload-server', serverUrl.value)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 服务器配置 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
      <h3 class="text-lg font-medium mb-4 dark:text-white">协调服务器配置</h3>

      <div class="flex items-center gap-4">
        <a-input
          v-model:value="serverUrl"
          placeholder="ws://localhost:9527"
          style="width: 300px"
          :disabled="isConnected"
          @blur="saveServerUrl"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ statusText }}
        </span>
      </div>

      <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>联动上传允许多个安装了此插件的用户协同上传，绕过单账户速率限制。</p>
        <p class="mt-1">
          运行协调服务器：
          <code class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            cd scripts/collaborative-upload-server && npm install && npm start
          </code>
        </p>
      </div>
    </div>

    <!-- 模式选择 -->
    <div class="grid grid-cols-2 gap-4">
      <!-- 工作者模式 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
        <h3 class="text-lg font-medium mb-4 dark:text-white">🔧 工作者模式</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          作为工作者帮助其他用户上传文件。你的上传配额将被用于处理任务。
        </p>

        <a-button
          :type="isWorkerMode ? 'default' : 'primary'"
          :danger="isWorkerMode"
          @click="toggleWorkerMode"
          :disabled="isMasterMode"
        >
          {{ isWorkerMode ? '停止工作' : '开始工作' }}
        </a-button>

        <!-- 工作者统计 -->
        <div
          v-if="isWorkerMode && isConnected"
          class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded"
        >
          <div class="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">完成：</span>
              <span class="ml-1 font-medium dark:text-white">{{ workerStats.completed }}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">失败：</span>
              <span class="ml-1 font-medium dark:text-white">{{ workerStats.failed }}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">流量：</span>
              <span class="ml-1 font-medium dark:text-white">
                {{ formatBytes(workerStats.totalBytes) }}
              </span>
            </div>
          </div>

          <!-- 当前任务 -->
          <div v-if="currentTask" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">当前任务</div>
            <div class="flex items-center justify-between">
              <div class="text-sm font-medium dark:text-white truncate flex-1 mr-2">
                {{ currentTask.filename }}
              </div>
              <div class="text-xs font-medium" :class="taskStatusColor">
                {{ taskStatusText }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 主控模式 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
        <h3 class="text-lg font-medium mb-4 dark:text-white">📤 主控模式</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          将上传任务分发给其他工作者，实现并行上传。
        </p>

        <a-button
          :type="isMasterMode ? 'default' : 'primary'"
          :danger="isMasterMode"
          @click="startMasterMode"
          :disabled="isWorkerMode"
        >
          {{ isMasterMode ? '断开连接' : '连接服务器' }}
        </a-button>

        <!-- 文件选择和上传 -->
        <div v-if="isMasterMode && isConnected" class="mt-4 space-y-3">
          <input
            type="file"
            multiple
            accept="image/*"
            @change="handleFileSelect"
            class="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300 hover:file:bg-blue-100"
          />

          <div v-if="selectedFiles.length > 0" class="text-sm text-gray-600 dark:text-gray-400">
            已选择 {{ selectedFiles.length }} 个文件
          </div>

          <a-button
            type="primary"
            @click="startCollaborativeUpload"
            :disabled="selectedFiles.length === 0 || isUploading"
            :loading="isUploading"
          >
            开始联动上传
          </a-button>

          <!-- 上传进度 -->
          <div v-if="uploadProgress" class="p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div class="flex justify-between text-sm mb-2">
              <span class="dark:text-white">上传进度</span>
              <span class="dark:text-gray-300">
                {{ uploadProgress.completed + uploadProgress.failed }} / {{ uploadProgress.total }}
              </span>
            </div>
            <a-progress
              :percent="
                Math.round(
                  ((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100
                )
              "
              :status="uploadProgress.failed > 0 ? 'exception' : 'active'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 服务器状态 -->
    <div
      v-if="isConnected && serverStats"
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-lg font-medium mb-4 dark:text-white">📊 服务器状态</h3>

      <div class="grid grid-cols-4 gap-4 text-center">
        <div class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ serverStats.workerCount }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">工作者</div>
        </div>
        <div class="p-3 bg-green-50 dark:bg-green-900/30 rounded">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ serverStats.idleWorkers }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">空闲</div>
        </div>
        <div class="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded">
          <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {{ serverStats.pendingTasks }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">待处理</div>
        </div>
        <div class="p-3 bg-purple-50 dark:bg-purple-900/30 rounded">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {{ serverStats.activeTasks }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">进行中</div>
        </div>
      </div>

      <!-- 工作者列表 -->
      <div v-if="serverStats.workers.length > 0" class="mt-4">
        <h4 class="text-sm font-medium mb-2 dark:text-white">在线工作者</h4>
        <div class="space-y-2">
          <div
            v-for="worker in serverStats.workers"
            :key="worker.id"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
          >
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                :class="worker.status === 'idle' ? 'bg-green-500' : 'bg-yellow-500'"
              ></span>
              <span class="font-mono dark:text-white">{{ worker.id.slice(0, 8) }}...</span>
            </div>
            <div class="text-gray-500 dark:text-gray-400">
              完成：{{ worker.stats.completed }} | 失败：{{ worker.stats.failed }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传结果 -->
    <div
      v-if="uploadResults.length > 0"
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-lg font-medium mb-4 dark:text-white">📋 上传结果</h3>

      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div
          v-for="(result, index) in uploadResults"
          :key="index"
          class="flex items-center justify-between p-2 rounded text-sm"
          :class="
            result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
          "
        >
          <div class="flex items-center gap-2">
            <span v-if="result.success" class="text-green-600">✓</span>
            <span v-else class="text-red-600">✗</span>
            <span class="dark:text-white">{{ result.filename }}</span>
          </div>
          <div v-if="result.success" class="text-gray-500 dark:text-gray-400">
            <a :href="result.url" target="_blank" class="text-blue-500 hover:underline">
              {{ result.url?.slice(0, 50) }}...
            </a>
          </div>
          <div v-else class="text-red-500">{{ result.error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
