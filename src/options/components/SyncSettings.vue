<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UploadOutlined, DownloadOutlined, SwapOutlined } from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import type {
  SyncResult,
  SyncTargetConfig,
  WebDAVConfig,
  S3Config,
  CloudflareConfig
} from '../../utils/syncTargets'

// TypeScript interface for sync progress
interface SyncProgress {
  current: number
  total: number
  action: 'push' | 'pull' | 'test' | 'both'
  message: string
}

const props = defineProps<{
  options: OptionsInject
  isConfigured: boolean
}>()

const { emojiStore } = props.options

// Sync type selection
const syncType = ref<'cloudflare' | 'webdav' | 's3'>('cloudflare')

// Local config state for different types
const cloudflareConfig = reactive({
  url: '',
  authToken: '',
  authTokenReadonly: ''
})

const webdavConfig = reactive({
  url: '',
  username: '',
  password: '',
  path: ''
})

const s3Config = reactive({
  endpoint: '',
  region: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  path: ''
})

// UI state
const isSaving = ref(false)
const isTesting = ref(false)
const isSyncing = ref(false)
const syncDirection = ref<'push' | 'pull' | 'both' | null>(null)
const testResult = ref<SyncResult | null>(null)
const syncResult = ref<{ success: boolean; message: string } | null>(null)
const syncProgress = ref<SyncProgress>({
  current: 0,
  total: 1,
  action: 'push',
  message: ''
})
const lastSyncTime = ref<number | null>(null)
const lastPushTime = ref<number | null>(null)
const lastPullTime = ref<number | null>(null)
const configSaved = ref(false) // Track if config has been saved

// Computed properties
const isValidConfig = computed(() => {
  switch (syncType.value) {
    case 'cloudflare':
      return cloudflareConfig.url && cloudflareConfig.authToken
    case 'webdav':
      return webdavConfig.url && webdavConfig.username && webdavConfig.password
    case 's3':
      return (
        s3Config.endpoint &&
        s3Config.region &&
        s3Config.bucket &&
        s3Config.accessKeyId &&
        s3Config.secretAccessKey
      )
    default:
      return false
  }
})

const syncProgressPercent = computed(() => {
  if (syncProgress.value.total <= 0) return 0
  return (syncProgress.value.current / syncProgress.value.total) * 100
})

const syncInProgress = computed(() => {
  return isSyncing.value && syncProgress.value.total > 0
})

// Load existing config on component mount
const loadConfig = async () => {
  console.log('[SyncSettings] Loading config on mount...')
  const config: any = await emojiStore.loadSyncConfig()
  console.log('[SyncSettings] Loaded config:', config)
  if (config) {
    syncType.value = config.type
    lastSyncTime.value = config.lastSyncTime || null

    // Load config based on type
    if (config.type === 'cloudflare') {
      cloudflareConfig.url = config.url || ''
      cloudflareConfig.authToken = config.authToken || ''
      cloudflareConfig.authTokenReadonly = config.authTokenReadonly || ''
      lastPushTime.value = (config as any).lastPushTime || null
      lastPullTime.value = (config as any).lastPullTime || null
    } else if (config.type === 'webdav') {
      webdavConfig.url = config.url || ''
      webdavConfig.username = config.username || ''
      webdavConfig.password = config.password || ''
      webdavConfig.path = config.path || ''
    } else if (config.type === 's3') {
      s3Config.endpoint = config.endpoint || ''
      s3Config.region = config.region || ''
      s3Config.bucket = config.bucket || ''
      s3Config.accessKeyId = config.accessKeyId || ''
      s3Config.secretAccessKey = config.secretAccessKey || ''
      s3Config.path = config.path || ''
    }

    configSaved.value = true
    console.log('[SyncSettings] Config loaded into form, type:', syncType.value)
  } else {
    console.warn('[SyncSettings] No config found')
  }
}

// Watch for changes to the store's sync configuration
watch(
  () => emojiStore.isSyncConfigured(),
  async configured => {
    if (configured) {
      const config: any = await emojiStore.loadSyncConfig()
      if (config) {
        lastSyncTime.value = config.lastSyncTime || null
        lastPushTime.value = config.lastPushTime || null
        lastPullTime.value = config.lastPullTime || null
      }
    }
  }
)

// Sync methods
const saveConfig = async () => {
  if (!isValidConfig.value) return

  isSaving.value = true
  try {
    let config: SyncTargetConfig

    switch (syncType.value) {
      case 'cloudflare':
        config = {
          type: 'cloudflare',
          enabled: true,
          url: cloudflareConfig.url,
          authToken: cloudflareConfig.authToken,
          authTokenReadonly:
            cloudflareConfig.authTokenReadonly && cloudflareConfig.authTokenReadonly.trim()
              ? cloudflareConfig.authTokenReadonly
              : undefined
        } as CloudflareConfig
        break
      case 'webdav':
        config = {
          type: 'webdav',
          enabled: true,
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password,
          path: webdavConfig.path || undefined
        } as WebDAVConfig
        break
      case 's3':
        config = {
          type: 's3',
          enabled: true,
          endpoint: s3Config.endpoint,
          region: s3Config.region,
          bucket: s3Config.bucket,
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
          path: s3Config.path || undefined
        } as S3Config
        break
      default:
        throw new Error('Invalid sync type')
    }

    await emojiStore.saveSyncConfig(config)

    // Mark config as saved to show sync operations section
    configSaved.value = true

    // Reload config to update sync times
    const savedConfig: any = await emojiStore.loadSyncConfig()
    if (savedConfig) {
      lastSyncTime.value = savedConfig.lastSyncTime || null
      lastPushTime.value = savedConfig.lastPushTime || null
      lastPullTime.value = savedConfig.lastPullTime || null
    }

    props.options.showSuccess('同步配置已保存')
  } catch (error) {
    console.error('Failed to save sync config:', error)
    props.options.showError('保存同步配置失败：' + (error as Error).message)
  } finally {
    isSaving.value = false
  }
}

const testConnection = async () => {
  if (!isValidConfig.value) return

  isTesting.value = true
  testResult.value = null

  try {
    // Create temporary config from current form values to test
    let tempConfig: SyncTargetConfig

    switch (syncType.value) {
      case 'cloudflare':
        tempConfig = {
          type: 'cloudflare',
          enabled: true,
          url: cloudflareConfig.url,
          authToken: cloudflareConfig.authToken,
          authTokenReadonly:
            cloudflareConfig.authTokenReadonly && cloudflareConfig.authTokenReadonly.trim()
              ? cloudflareConfig.authTokenReadonly
              : undefined
        } as CloudflareConfig
        break
      case 'webdav':
        tempConfig = {
          type: 'webdav',
          enabled: true,
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password,
          path: webdavConfig.path || undefined
        } as WebDAVConfig
        break
      case 's3':
        tempConfig = {
          type: 's3',
          enabled: true,
          endpoint: s3Config.endpoint,
          region: s3Config.region,
          bucket: s3Config.bucket,
          accessKeyId: s3Config.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey,
          path: s3Config.path || undefined
        } as S3Config
        break
      default:
        throw new Error('Invalid sync type')
    }

    // Test with temporary config (don't save yet)
    const result = await emojiStore.testSyncConnection(tempConfig)
    testResult.value = result

    if (result.success) {
      props.options.showSuccess('连接测试成功')
    } else {
      props.options.showError('连接测试失败：' + result.message)
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: `连接测试失败：${(error as Error).message}`,
      error
    }
    props.options.showError('连接测试失败：' + (error as Error).message)
  } finally {
    isTesting.value = false
  }
}

const sync = async (direction: 'push' | 'pull' | 'both') => {
  if (!props.isConfigured) {
    props.options.showError('请先配置同步参数')
    return
  }

  isSyncing.value = true
  syncDirection.value = direction
  syncResult.value = null

  // 初始化进度
  syncProgress.value = {
    current: 0,
    total: 1,
    action: direction === 'both' ? 'push' : direction,
    message: '准备开始同步...'
  }

  try {
    // 传递进度回调函数
    const result = await emojiStore.syncToCloudflare(direction, progress => {
      // 更新进度状态
      syncProgress.value = {
        current: progress.current,
        total: progress.total,
        action: (progress.action || direction) as 'push' | 'pull' | 'both',
        message: progress.message || ''
      }
      console.log('[SyncSettingsPage] Progress update:', progress)
    })

    syncResult.value = result

    if (result.success) {
      props.options.showSuccess(`${getDirectionText(direction)}同步完成`)
    } else {
      props.options.showError(`${getDirectionText(direction)}同步失败：${result.message}`)
    }
  } catch (error) {
    const errorMessage = `同步失败：${(error as Error).message}`
    syncResult.value = { success: false, message: errorMessage }
    props.options.showError(errorMessage)
  } finally {
    isSyncing.value = false
    syncDirection.value = null
  }
}

const getDirectionText = (direction: 'push' | 'pull' | 'both') => {
  switch (direction) {
    case 'push':
      return '推送'
    case 'pull':
      return '拉取'
    case 'both':
      return '双向'
    default:
      return '同步'
  }
}

// Initialize on mount
loadConfig()

// Expose methods and data
defineExpose({
  loadConfig,
  saveConfig,
  testConnection,
  sync
})
</script>

<template>
  <div class="space-y-4">
    <!-- Sync Configuration Form -->
    <div class="space-y-4">
      <!-- Sync Type Selection -->
      <div class="mb-4">
        <label class="block text-sm font-medium dark:text-white mb-2">同步类型</label>
        <a-select
          v-model:value="syncType"
          :disabled="isSyncing"
          class="w-full max-w-md"
          aria-label="选择同步类型"
        >
          <a-select-option value="cloudflare">☁️ Cloudflare Worker</a-select-option>
          <a-select-option value="webdav">📁 WebDAV</a-select-option>
          <a-select-option value="s3">🪣 Amazon S3</a-select-option>
        </a-select>
      </div>

      <!-- Cloudflare Configuration -->
      <div v-if="syncType === 'cloudflare'" class="space-y-4">
        <div>
          <label for="cfUrl" class="block text-sm font-medium dark:text-white mb-1">
            Worker URL
          </label>
          <a-input
            id="cfUrl"
            v-model:value="cloudflareConfig.url"
            placeholder="https://your-worker.your-account.workers.dev"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">
            输入你的 Cloudflare Worker 部署地址
          </p>
        </div>

        <div>
          <label for="cfAuthToken" class="block text-sm font-medium dark:text-white mb-1">
            认证令牌
          </label>
          <a-input-password
            id="cfAuthToken"
            v-model:value="cloudflareConfig.authToken"
            placeholder="输入读写权限的认证令牌"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">用于写入和删除操作的认证令牌</p>
        </div>

        <div>
          <label for="cfAuthTokenReadonly" class="block text-sm font-medium dark:text-white mb-1">
            只读认证令牌 (可选)
          </label>
          <a-input-password
            id="cfAuthTokenReadonly"
            v-model:value="cloudflareConfig.authTokenReadonly"
            placeholder="输入只读权限的认证令牌"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">
            用于只读操作的认证令牌 (如果与读写令牌相同可留空)
          </p>
        </div>
      </div>

      <!-- WebDAV Configuration -->
      <div v-if="syncType === 'webdav'" class="space-y-4">
        <div>
          <label for="wdUrl" class="block text-sm font-medium dark:text-white mb-1">
            WebDAV 服务器地址
          </label>
          <a-input
            id="wdUrl"
            v-model:value="webdavConfig.url"
            placeholder="https://your-webdav-server.com"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">WebDAV 服务器的完整 URL</p>
        </div>

        <div>
          <label for="wdUsername" class="block text-sm font-medium dark:text-white mb-1">
            用户名
          </label>
          <a-input
            id="wdUsername"
            v-model:value="webdavConfig.username"
            placeholder="输入用户名"
            :disabled="isSyncing"
          />
        </div>

        <div>
          <label for="wdPassword" class="block text-sm font-medium dark:text-white mb-1">
            密码
          </label>
          <a-input-password
            id="wdPassword"
            v-model:value="webdavConfig.password"
            placeholder="输入密码"
            :disabled="isSyncing"
          />
        </div>

        <div>
          <label for="wdPath" class="block text-sm font-medium dark:text-white mb-1">
            文件路径 (可选)
          </label>
          <a-input
            id="wdPath"
            v-model:value="webdavConfig.path"
            placeholder="emoji-data.json"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">在服务器上存储数据的文件名</p>
        </div>
      </div>

      <!-- S3 Configuration -->
      <div v-if="syncType === 's3'" class="space-y-4">
        <div>
          <label for="s3Endpoint" class="block text-sm font-medium dark:text-white mb-1">
            S3 端点
          </label>
          <a-input
            id="s3Endpoint"
            v-model:value="s3Config.endpoint"
            placeholder="s3.amazonaws.com 或自定义端点"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">S3 兼容服务的端点地址</p>
        </div>

        <div>
          <label for="s3Region" class="block text-sm font-medium dark:text-white mb-1">区域</label>
          <a-input
            id="s3Region"
            v-model:value="s3Config.region"
            placeholder="us-east-1"
            :disabled="isSyncing"
          />
        </div>

        <div>
          <label for="s3Bucket" class="block text-sm font-medium dark:text-white mb-1">
            存储桶名称
          </label>
          <a-input
            id="s3Bucket"
            v-model:value="s3Config.bucket"
            placeholder="my-emoji-backup"
            :disabled="isSyncing"
          />
        </div>

        <div>
          <label for="s3AccessKeyId" class="block text-sm font-medium dark:text-white mb-1">
            Access Key ID
          </label>
          <a-input
            id="s3AccessKeyId"
            v-model:value="s3Config.accessKeyId"
            placeholder="输入 Access Key ID"
            :disabled="isSyncing"
          />
        </div>

        <div>
          <label for="s3SecretAccessKey" class="block text-sm font-medium dark:text-white mb-1">
            Secret Access Key
          </label>
          <a-input-password
            id="s3SecretAccessKey"
            v-model:value="s3Config.secretAccessKey"
            placeholder="输入 Secret Access Key"
            :disabled="isSyncing"
          />
        </div>

        <div>
          <label for="s3Path" class="block text-sm font-medium dark:text-white mb-1">
            对象键前缀 (可选)
          </label>
          <a-input
            id="s3Path"
            v-model:value="s3Config.path"
            placeholder="emoji-data.json"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">存储桶中的对象键</p>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2">
        <a-button
          type="primary"
          @click="saveConfig"
          :loading="isSaving"
          :disabled="isSyncing || !isValidConfig"
        >
          {{ isSaving ? '保存中...' : '保存配置' }}
        </a-button>

        <a-button
          @click="testConnection"
          :loading="isTesting"
          :disabled="isSyncing || !isValidConfig"
        >
          {{ isTesting ? '测试中...' : '测试连接' }}
        </a-button>
      </div>

      <!-- Status messages -->
      <div
        v-if="testResult"
        class="p-3 rounded border"
        :class="testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
      >
        <p class="text-sm" :class="testResult.success ? 'text-green-700' : 'text-red-700'">
          {{ testResult.message }}
        </p>
      </div>
    </div>

    <!-- Sync Operations -->
    <div v-if="isConfigured" class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
      <h3 class="text-md font-medium dark:text-white mb-4">同步操作</h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <a-button
          type="primary"
          @click="sync('push')"
          :loading="isSyncing && syncDirection === 'push'"
          :disabled="!isConfigured || isSyncing"
          block
        >
          <template #icon>
            <UploadOutlined />
          </template>
          推送到云端
        </a-button>

        <a-button
          @click="sync('pull')"
          :loading="isSyncing && syncDirection === 'pull'"
          :disabled="!isConfigured || isSyncing"
          block
        >
          <template #icon>
            <DownloadOutlined />
          </template>
          从云端拉取
        </a-button>

        <a-button
          @click="sync('both')"
          :loading="isSyncing && syncDirection === 'both'"
          :disabled="!isConfigured || isSyncing"
          block
        >
          <template #icon>
            <SwapOutlined />
          </template>
          双向同步
        </a-button>
      </div>

      <!-- Sync Progress -->
      <div v-if="isSyncing" class="mt-4 space-y-3">
        <!-- Progress header -->
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium dark:text-white">
            {{
              syncDirection === 'push'
                ? '⬆️ 推送中'
                : syncDirection === 'pull'
                  ? '⬇️ 拉取中'
                  : '🔄 同步中'
            }}
          </span>
          <span class="text-sm font-semibold dark:text-white">
            {{ syncProgress.current }} / {{ syncProgress.total }}
          </span>
        </div>

        <!-- Current item being processed -->
        <div
          v-if="syncProgress.message"
          class="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
        >
          <p class="text-xs text-blue-700 dark:text-blue-300 font-mono">
            {{ syncProgress.message }}
          </p>
        </div>

        <!-- Progress bar -->
        <a-progress
          :percent="syncProgressPercent"
          :status="syncInProgress ? 'active' : 'normal'"
          :show-info="false"
        />

        <!-- Progress percentage -->
        <div class="text-right">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ Math.round(syncProgressPercent) }}% 完成
          </span>
        </div>
      </div>

      <!-- Sync Status Messages -->
      <div
        v-if="syncResult"
        class="mt-3 p-3 rounded border"
        :class="syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
      >
        <p class="text-sm" :class="syncResult.success ? 'text-green-700' : 'text-red-700'">
          {{ syncResult.message }}
        </p>
      </div>
    </div>

    <!-- Last sync times -->
    <div
      v-if="lastSyncTime"
      class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6 text-sm text-gray-600 dark:text-white"
    >
      <p>最近同步时间：{{ new Date(lastSyncTime).toLocaleString() }}</p>
      <p v-if="lastPushTime">最近推送：{{ new Date(lastPushTime).toLocaleString() }}</p>
      <p v-if="lastPullTime">最近拉取：{{ new Date(lastPullTime).toLocaleString() }}</p>
    </div>
  </div>
</template>
