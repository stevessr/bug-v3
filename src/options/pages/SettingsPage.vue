<script setup lang="ts">
import { inject, ref, reactive, computed, onMounted, watch } from 'vue'
import {
  UploadOutlined,
  DownloadOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import type {
  SyncResult,
  SyncTargetConfig,
  WebDAVConfig,
  S3Config,
  CloudflareConfig
} from '../../userscript/plugins/syncTargets'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import ThemeSettings from '../components/ThemeSettings.vue'
import UISettings from '../components/UISettings.vue'
import FeatureSwitchSettings from '../components/FeatureSwitchSettings.vue'
import MenuBarSettings from '../components/MenuBarSettings.vue'
import CustomCSSSettings from '../components/CustomCSSSettings.vue'
import AISettings from '../components/AISettings.vue'

// TypeScript interface for sync progress
interface SyncProgress {
  current: number
  total: number
  action: 'push' | 'pull' | 'test' | 'both'
  message: string
}

const options = inject<OptionsInject>('options')!

const {
  emojiStore,
  localGridColumns,
  updateImageScale,
  updateShowSearchBar,
  updateOutputFormat,
  updateForceMobileMode,
  updateEnableLinuxDoInjection,
  updateEnableXcomExtraSelectors,
  updateEnableCalloutSuggestions,
  updateEnableBatchParseImages,
  updateEnableHoverPreview,
  updateSyncVariantToDisplayUrl,
  updateTheme,
  updateCustomPrimaryColor,
  updateCustomColorScheme,
  updateCustomCss,
  updateUploadMenuItems,
  updateGeminiApiKey,
  updateGeminiApiUrl,
  updateGeminiLanguage,
  updateGeminiModel,
  updateUseCustomOpenAI,
  updateCustomOpenAIEndpoint,
  updateCustomOpenAIKey,
  updateCustomOpenAIModel,
  updateImdbedToken,
  updateImdbedApiUrl
} = options

const activeTab = ref('theme')

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
const isPreviewing = ref(false)
const syncDirection = ref<'push' | 'pull' | 'both' | null>(null)
const testResult = ref<SyncResult | null>(null)
const syncResult = ref<{ success: boolean; message: string } | null>(null)
const previewResult = ref<{ success: boolean; data?: any; message: string } | null>(null)
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

// Preview data state
const cloudData = ref<any>(null)
const showPreviewDialog = ref(false)

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

const previewInProgress = computed(() => {
  return isPreviewing.value && syncProgress.value.total > 0
})

// Load existing config on component mount
onMounted(async () => {
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
})

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

// State for group details modal
const showGroupDetailsModal = ref(false)
const selectedGroup = ref<any>(null)
const groupDetails = ref<any>(null)
const isLoadingGroupDetails = ref(false)

// Preview cloud data
const previewCloudData = async () => {
  if (!isConfigured.value) {
    options.showError('请先配置同步参数')
    return
  }

  isPreviewing.value = true
  previewResult.value = null
  cloudData.value = null

  // 初始化进度
  syncProgress.value = {
    current: 0,
    total: 1,
    action: 'test',
    message: '准备预览云端配置...'
  }

  try {
    // 传递进度回调函数
    const result = await emojiStore.previewCloudConfig(progress => {
      // 更新进度状态
      syncProgress.value = {
        current: progress.current,
        total: progress.total,
        action: progress.action || 'test',
        message: progress.message || ''
      }
      console.log('[SettingsPage] Preview progress update:', progress)
    })

    previewResult.value = result

    if (result.success && result.config) {
      console.log('[SettingsPage] Preview config data:', result.config)
      cloudData.value = result.config
      showPreviewDialog.value = true
      options.showSuccess('云端配置预览成功')
    } else {
      console.error('[SettingsPage] Preview failed:', result)
      options.showError('预览云端配置失败：' + result.message)
    }
  } catch (error) {
    const errorMessage = `预览失败：${(error as Error).message}`
    previewResult.value = { success: false, message: errorMessage }
    options.showError(errorMessage)
  } finally {
    isPreviewing.value = false
  }
}

// Load group details (lazy loading)
const loadGroupDetails = async (group: any) => {
  if (!group || !group.name) {
    options.showError('无效的分组信息')
    return
  }

  if (group.emojis) {
    selectedGroup.value = group
    groupDetails.value = group
    showGroupDetailsModal.value = true
    isLoadingGroupDetails.value = false
    return
  }

  selectedGroup.value = group
  showGroupDetailsModal.value = true
  isLoadingGroupDetails.value = true
  groupDetails.value = null

  try {
    const result = await emojiStore.loadGroupDetails(group.name, progress => {
      console.log('[SettingsPage] Loading group details progress:', progress)
    })

    if (result.success && result.group) {
      // Update the group in cloudData with the full details
      const groupIndex = cloudData.value.emojiGroups.findIndex((g: any) => g.name === group.name)
      if (groupIndex !== -1) {
        cloudData.value.emojiGroups[groupIndex] = { ...group, ...result.group }
      }
      groupDetails.value = result.group
      showGroupDetailsModal.value = true
    } else {
      options.showError('加载分组详情失败：' + result.message)
    }
  } catch (error) {
    const errorMessage = `加载分组详情失败：${(error as Error).message}`
    options.showError(errorMessage)
  } finally {
    isLoadingGroupDetails.value = false
  }
}

// Close group details modal
const closeGroupDetailsModal = () => {
  showGroupDetailsModal.value = false
  selectedGroup.value = null
  groupDetails.value = null
}

// Close preview dialog
const closePreviewDialog = () => {
  showPreviewDialog.value = false
  cloudData.value = null
  previewResult.value = null
}

// Utility functions for preview modal
const getTotalEmojis = (data: any): number => {
  if (!data.emojiGroups) return 0
  return data.emojiGroups.reduce((total: number, group: any) => {
    return total + (group.emojis?.length || 0)
  }, 0)
}

const formatDate = (timestamp: number | string | undefined): string => {
  if (!timestamp) return 'N/A'

  // 处理对象类型的情况
  if (typeof timestamp === 'object') {
    console.warn('[SettingsPage] formatDate received object:', timestamp)
    return 'Invalid Date'
  }

  try {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('[SettingsPage] Invalid date created from timestamp:', timestamp)
      return 'Invalid Date'
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.error('[SettingsPage] Error formatting date:', error, 'timestamp:', timestamp)
    return 'N/A'
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Sub-tabs for settings -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <a-tabs v-model:activeKey="activeTab" class="px-4">
        <a-tab-pane key="theme" tab="主题">
          <div class="py-4">
            <ThemeSettings
              :settings="emojiStore.settings"
              @update:theme="updateTheme"
              @update:customPrimaryColor="updateCustomPrimaryColor"
              @update:customColorScheme="updateCustomColorScheme"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="ui" tab="UI">
          <div class="py-4">
            <UISettings
              :settings="emojiStore.settings"
              @update:imageScale="updateImageScale"
              @update:showSearchBar="updateShowSearchBar"
              @update:enableHoverPreview="updateEnableHoverPreview"
              @update:syncVariantToDisplayUrl="updateSyncVariantToDisplayUrl"
            >
              <template #grid-selector>
                <GridColumnsSelector v-model="localGridColumns" :min="2" :max="8" :step="1" />
              </template>
            </UISettings>
          </div>
        </a-tab-pane>

        <a-tab-pane key="switches" tab="开关">
          <div class="py-4">
            <FeatureSwitchSettings
              :settings="emojiStore.settings"
              @update:outputFormat="updateOutputFormat"
              @update:forceMobileMode="updateForceMobileMode"
              @update:enableLinuxDoInjection="updateEnableLinuxDoInjection"
              @update:enableXcomExtraSelectors="updateEnableXcomExtraSelectors"
              @update:enableCalloutSuggestions="updateEnableCalloutSuggestions"
              @update:enableBatchParseImages="updateEnableBatchParseImages"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="menu" tab="菜单栏">
          <div class="py-4">
            <MenuBarSettings
              :settings="emojiStore.settings"
              @update:uploadMenuItems="updateUploadMenuItems"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="css" tab="自定义CSS">
          <div class="py-4">
            <CustomCSSSettings
              :settings="emojiStore.settings"
              @update:customCss="updateCustomCss"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="ai" tab="AI">
          <div class="py-4">
            <AISettings
              :settings="emojiStore.settings"
              @update:geminiApiKey="updateGeminiApiKey"
              @update:geminiApiUrl="updateGeminiApiUrl"
              @update:geminiLanguage="updateGeminiLanguage"
              @update:geminiModel="updateGeminiModel"
              @update:useCustomOpenAI="updateUseCustomOpenAI"
              @update:customOpenAIEndpoint="updateCustomOpenAIEndpoint"
              @update:customOpenAIKey="updateCustomOpenAIKey"
              @update:customOpenAIModel="updateCustomOpenAIModel"
              @update:imgbedToken="updateImdbedToken"
              @update:imgbedApiUrl="updateImdbedApiUrl"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="sync" tab="云同步">
          <div class="py-4">
            <!-- Sync Configuration Form -->
            <div class="space-y-4">
              <!-- Sync Type Selection -->
              <div class="mb-4">
                <label class="block text-sm font-medium dark:text-white mb-2">同步类型</label>
                <a-radio-group v-model:value="syncType" :disabled="isSyncing" button-style="solid">
                  <a-radio-button value="cloudflare">☁️ Cloudflare Worker</a-radio-button>
                  <a-radio-button value="webdav">📁 WebDAV</a-radio-button>
                  <a-radio-button value="s3">🪣 Amazon S3</a-radio-button>
                </a-radio-group>
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
                  <p class="text-xs text-gray-500 dark:text-white mt-1">
                    用于写入和删除操作的认证令牌
                  </p>
                </div>

                <div>
                  <label
                    for="cfAuthTokenReadonly"
                    class="block text-sm font-medium dark:text-white mb-1"
                  >
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
                  <p class="text-xs text-gray-500 dark:text-white mt-1">
                    在服务器上存储数据的文件名
                  </p>
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
                  <label for="s3Region" class="block text-sm font-medium dark:text-white mb-1">
                    区域
                  </label>
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
                  <label
                    for="s3SecretAccessKey"
                    class="block text-sm font-medium dark:text-white mb-1"
                  >
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

                <a-button
                  @click="previewCloudData"
                  :loading="isPreviewing"
                  :disabled="!isConfigured || isSyncing || isPreviewing"
                >
                  {{ isPreviewing ? '预览中...' : '预览云端数据' }}
                </a-button>
              </div>

              <!-- Status messages -->
              <div
                v-if="testResult"
                class="p-3 rounded border"
                :class="
                  testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                "
              >
                <p class="text-sm" :class="testResult.success ? 'text-green-700' : 'text-red-700'">
                  {{ testResult.message }}
                </p>
              </div>
            </div>

            <!-- Sync Operations -->
            <div
              v-if="isConfigured"
              class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6"
            >
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
                :class="
                  syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                "
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
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- Cloud Data Preview Modal -->
    <a-modal v-model:open="showPreviewDialog" title="云端配置预览" width="800px">
      <template #footer>
        <a-button @click="showPreviewDialog = false">关闭</a-button>
      </template>
      <div v-if="previewResult && cloudData" class="space-y-6">
        <!-- Preview Status -->
        <div
          class="p-4 rounded-lg border"
          :class="
            previewResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          "
        >
          <div class="flex items-center space-x-2">
            <CheckCircleOutlined v-if="previewResult.success" class="text-green-600" />
            <ExclamationCircleOutlined v-else class="text-red-600" />
            <span
              class="font-medium"
              :class="previewResult.success ? 'text-green-700' : 'text-red-700'"
            >
              {{ previewResult.success ? '云端配置获取成功' : '云端配置获取失败' }}
            </span>
          </div>
          <p class="text-sm text-gray-600 mt-1">{{ previewResult.message }}</p>
        </div>

        <!-- Cloud Data Statistics -->
        <div v-if="previewResult.success && cloudData" class="space-y-4">
          <h4 class="text-lg font-semibold text-gray-800 dark:text白">配置概览</h4>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                <CheckCircleOutlined
                  v-if="typeof cloudData.connectionTest === 'boolean' && cloudData.connectionTest"
                />
                <ExclamationCircleOutlined v-else />
              </div>
              <div class="text-sm text-blue-700 dark:text-blue-300">连接状态</div>
            </div>

            <div
              class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                {{ cloudData.metadata?.totalGroups || 0 }}
              </div>
              <div class="text-sm text-green-700 dark:text-green-300">分组数量</div>
            </div>

            <div
              class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800"
            >
              <div class="text-lg font-bold text-orange-600 dark:text-orange-400">
                {{
                  typeof cloudData.timestamp === 'object'
                    ? 'Invalid Date'
                    : formatDate(cloudData.timestamp)
                }}
              </div>
              <div class="text-sm text-orange-700 dark:text-orange-300">检查时间</div>
            </div>
          </div>

          <!-- Settings/Metadata Info -->
          <div v-if="cloudData.settings && Object.keys(cloudData.settings).length > 0">
            <h5 class="text-md font-semibold text灰色-700 dark:text白 mb-3">设置信息</h5>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text-gray-400">版本</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{ typeof cloudData.version === 'object' ? 'N/A' : cloudData.version || 'N/A' }}
                </div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">收藏数量</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{ cloudData.metadata?.favoritesCount || 0 }}
                </div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">最后修改</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{
                    cloudData.metadata?.lastModified
                      ? formatDate(cloudData.metadata.lastModified)
                      : 'N/A'
                  }}
                </div>
              </div>
            </div>
          </div>

          <!-- Emoji Groups Details -->
          <div v-if="cloudData.emojiGroups && cloudData.emojiGroups.length > 0">
            <h5 class="text-md font-semibold text灰色-700 dark:text白 mb-3">表情分组</h5>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="group in cloudData.emojiGroups"
                :key="group.id"
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                @click="loadGroupDetails(group)"
              >
                <div class="flex items-center space-x-3">
                  <div
                    class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text白 text-xs font-bold"
                  >
                    {{ group.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="font-medium text-gray-800 dark:text白">{{ group.name }}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="text-blue-500 dark:text-blue-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-2 text-xs text-gray-500 dark:text灰色-400 text-center">
              点击分组查看详细信息
            </div>
          </div>

          <!-- Connection Info -->
          <div>
            <h5 class="text-md font-semibold text灰色-700 dark:text白 mb-3">连接信息</h5>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">数据可用性</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{
                    typeof cloudData.hasData === 'boolean'
                      ? cloudData.hasData
                        ? '可用'
                        : '无数据'
                      : '未知'
                  }}
                </div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div class="text-gray-500 dark:text灰色-400">同步服务</div>
                <div class="font-medium text-gray-800 dark:text白">
                  {{
                    syncType === 'cloudflare'
                      ? 'Cloudflare'
                      : syncType === 'webdav'
                        ? 'WebDAV'
                        : syncType === 's3'
                          ? 'S3'
                          : '未知'
                  }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="isPreviewing" class="flex items-center justify-center py-8">
        <a-spin size="large" />
        <span class="ml-3 text-gray-600 dark:text灰色-400">正在检查云端配置...</span>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text灰色-400">暂无配置可预览</div>
    </a-modal>

    <!-- Group Details Modal -->
    <a-modal
      v-model:open="showGroupDetailsModal"
      :title="selectedGroup?.name ? `分组详情：${selectedGroup.name}` : '分组详情'"
      width="720px"
      @cancel="closeGroupDetailsModal"
    >
      <template #footer>
        <a-button @click="closeGroupDetailsModal">关闭</a-button>
      </template>

      <div v-if="isLoadingGroupDetails" class="flex items-center justify-center py-8">
        <a-spin size="large" />
        <span class="ml-3 text-gray-600 dark:text-gray-400">正在加载分组详情...</span>
      </div>

      <div v-else-if="groupDetails" class="space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div class="text-gray-500 dark:text-gray-400">表情数量</div>
            <div class="text-xl font-semibold text-gray-800 dark:text-white">
              {{ groupDetails.emojis?.length || 0 }}
            </div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <div class="text-gray-500 dark:text-gray-400">更新时间</div>
            <div class="font-medium text-gray-800 dark:text-white">
              {{ formatDate(groupDetails.lastModified || groupDetails.createdAt) }}
            </div>
          </div>
        </div>

        <div
          v-if="groupDetails.description"
          class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="text-sm text-gray-600 dark:text-gray-300">分组备注</div>
          <p class="mt-1 text-gray-800 dark:text-white whitespace-pre-line">
            {{ groupDetails.description }}
          </p>
        </div>

        <div v-if="groupDetails.emojis?.length" class="space-y-4">
          <h5 class="text-md font-semibold text-gray-700 dark:text-white">表情列表</h5>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            <div
              v-for="(emoji, index) in groupDetails.emojis"
              :key="emoji.id || emoji.name || index"
              class="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div
                class="w-12 h-12 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
              >
                <img
                  v-if="emoji.displayUrl || emoji.url"
                  :src="emoji.displayUrl || emoji.url"
                  :alt="emoji.name || `emoji-${index}`"
                  class="w-full h-full object-contain"
                />
                <span v-else class="text-xs text-gray-400">无预览</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 dark:text-white truncate">
                  {{ emoji.name || `表情 ${index + 1}` }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 break-all">
                  {{ emoji.url || emoji.displayUrl || '无 URL' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-6 text-gray-500 dark:text-gray-400">该分组暂无表情</div>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">暂无分组详情可展示</div>
    </a-modal>
  </div>
</template>
