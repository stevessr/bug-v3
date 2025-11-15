<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { UploadOutlined, DownloadOutlined, SwapOutlined } from '@ant-design/icons-vue'
import { inject } from 'vue'

import type { SyncResult } from '../../userscript/plugins/syncTargets'
import type { ExtendedCloudflareConfig } from '../../utils/cloudflareSync'
import type { OptionsInject } from '../types'

// TypeScript interface for sync progress
interface SyncProgress {
  current: number
  total: number
  action: 'push' | 'pull' | 'test' | 'both'
  message: string
}

// Inject the options store
const options = inject<OptionsInject>('options')!
const { emojiStore } = options

// Local config state
const localConfig = reactive<Partial<ExtendedCloudflareConfig>>({
  url: '',
  authToken: '',
  authTokenReadonly: ''
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
  return localConfig.url && localConfig.authToken
})

const isConfigured = computed(() => {
  return configSaved.value || emojiStore.isSyncConfigured()
})

const syncProgressPercent = computed(() => {
  if (syncProgress.value.total <= 0) return 0
  return (syncProgress.value.current / syncProgress.value.total) * 100
})

const syncInProgress = computed(() => {
  return isSyncing.value && syncProgress.value.total > 0
})

// Load existing config on component mount
onMounted(async () => {
  console.log('[SyncSettings] Loading config on mount...')
  const config = await emojiStore.loadSyncConfig()
  console.log('[SyncSettings] Loaded config:', config)
  if (config) {
    localConfig.url = config.url || ''
    localConfig.authToken = config.authToken || ''
    localConfig.authTokenReadonly = config.authTokenReadonly || ''
    lastSyncTime.value = config.lastSyncTime || null
    lastPushTime.value = config.lastPushTime || null
    lastPullTime.value = config.lastPullTime || null
    configSaved.value = true // Mark as saved if config exists
    console.log('[SyncSettings] Config loaded into form:', { 
      url: localConfig.url, 
      hasAuthToken: !!localConfig.authToken,
      hasReadonlyToken: !!localConfig.authTokenReadonly 
    })
  } else {
    console.warn('[SyncSettings] No config found')
  }
})

// Watch for changes to the store's sync configuration
watch(
  () => emojiStore.isSyncConfigured(),
  async configured => {
    if (configured) {
      const config = await emojiStore.loadSyncConfig()
      if (config) {
        lastSyncTime.value = config.lastSyncTime || null
        lastPushTime.value = config.lastPushTime || null
        lastPullTime.value = config.lastPullTime || null
      }
    }
  }
)

// Methods
const saveConfig = async () => {
  if (!isValidConfig.value) return

  isSaving.value = true
  try {
    const config: ExtendedCloudflareConfig = {
      type: 'cloudflare',
      enabled: true,
      url: localConfig.url!,
      authToken: localConfig.authToken!,
      // Only include authTokenReadonly if it's not empty
      authTokenReadonly: localConfig.authTokenReadonly && localConfig.authTokenReadonly.trim() 
        ? localConfig.authTokenReadonly 
        : undefined
    }

    await emojiStore.saveSyncConfig(config)
    
    // Mark config as saved to show sync operations section
    configSaved.value = true
    
    // Reload config to update sync times and trigger the isConfigured computed property
    const savedConfig = await emojiStore.loadSyncConfig()
    if (savedConfig) {
      lastSyncTime.value = savedConfig.lastSyncTime || null
      lastPushTime.value = savedConfig.lastPushTime || null
      lastPullTime.value = savedConfig.lastPullTime || null
    }
    
    options.showSuccess('同步配置已保存')
  } catch (error) {
    console.error('Failed to save sync config:', error)
    options.showError('保存同步配置失败：' + (error as Error).message)
  } finally {
    isSaving.value = false
  }
}

const testConnection = async () => {
  if (!isValidConfig.value) return

  isTesting.value = true
  testResult.value = null

  try {
    // Temporarily create config to test with
    const result = await emojiStore.testSyncConnection()
    testResult.value = result

    if (result.success) {
      options.showSuccess('连接测试成功')
    } else {
      options.showError('连接测试失败：' + result.message)
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: `连接测试失败：${(error as Error).message}`,
      error
    }
    options.showError('连接测试失败：' + (error as Error).message)
  } finally {
    isTesting.value = false
  }
}

const sync = async (direction: 'push' | 'pull' | 'both') => {
  if (!isConfigured.value) {
    options.showError('请先配置同步参数')
    return
  }

  isSyncing.value = true
  syncDirection.value = direction
  syncResult.value = null
  // Use 'push' as default action when starting sync; actual action will be updated during operation
  syncProgress.value = {
    current: 0,
    total: 1,
    action: direction === 'both' ? 'push' : direction,
    message: '准备开始同步...'
  }

  try {
    const result = await emojiStore.syncToCloudflare(direction)
    syncResult.value = result

    if (result.success) {
      options.showSuccess(`${getDirectionText(direction)}同步完成`)
    } else {
      options.showError(`${getDirectionText(direction)}同步失败：${result.message}`)
    }
  } catch (error) {
    const errorMessage = `同步失败：${(error as Error).message}`
    syncResult.value = { success: false, message: errorMessage }
    options.showError(errorMessage)
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
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">云同步设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <!-- Sync Configuration Form -->
      <div class="space-y-4">
        <div class="mb-4">
          <label class="block text-sm font-medium dark:text-white mb-1">同步类型</label>
          <div class="text-sm dark:text-white">
            <span class="inline-flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
              Cloudflare Worker
            </span>
          </div>
        </div>

        <div>
          <label for="syncUrl" class="block text-sm font-medium dark:text-white mb-1">
            Worker URL
          </label>
          <a-input
            id="syncUrl"
            v-model:value="localConfig.url"
            placeholder="https://your-worker.your-account.workers.dev"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">
            输入你的 Cloudflare Worker 部署地址
          </p>
        </div>

        <div>
          <label for="authToken" class="block text-sm font-medium dark:text-white mb-1">
            认证令牌
          </label>
          <a-input-password
            id="authToken"
            v-model:value="localConfig.authToken"
            placeholder="输入读写权限的认证令牌"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">用于写入和删除操作的认证令牌</p>
        </div>

        <div>
          <label for="authTokenReadonly" class="block text-sm font-medium dark:text-white mb-1">
            只读认证令牌 (可选)
          </label>
          <a-input-password
            id="authTokenReadonly"
            v-model:value="localConfig.authTokenReadonly"
            placeholder="输入只读权限的认证令牌"
            :disabled="isSyncing"
          />
          <p class="text-xs text-gray-500 dark:text-white mt-1">
            用于只读操作的认证令牌 (如果与读写令牌相同可留空)
          </p>
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
      <div v-if="isConfigured" class="border-t border-gray-200 dark:border-gray-700 pt-6">
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
        <div v-if="isSyncing" class="mt-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm dark:text-white">{{ syncProgress.message }}</span>
            <span class="text-sm dark:text-white">{{ Math.round(syncProgressPercent) }}%</span>
          </div>
          <a-progress
            :percent="syncProgressPercent"
            :status="syncInProgress ? 'active' : 'normal'"
          />
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
        class="border-t border-gray-200 dark:border-gray-700 pt-4 text-sm text-gray-600 dark:text-white"
      >
        <p>最近同步时间：{{ new Date(lastSyncTime).toLocaleString() }}</p>
        <p v-if="lastPushTime">最近推送：{{ new Date(lastPushTime).toLocaleString() }}</p>
        <p v-if="lastPullTime">最近拉取：{{ new Date(lastPullTime).toLocaleString() }}</p>
      </div>
    </div>
  </div>
</template>
