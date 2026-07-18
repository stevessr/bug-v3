<script setup lang="ts">
import { defineAsyncComponent, inject, ref, computed, onMounted } from 'vue'

import type { OptionsInject } from '../types'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'

// 将每个 tab 内的设置面板拆分为独立 chunk，按需异步加载
// SettingsPage 初始体积从 ~458KB 降低，仅加载当前激活 tab 对应模块
const ThemeSettings = defineAsyncComponent(() => import('../components/ThemeSettings.vue'))
const UISettings = defineAsyncComponent(() => import('../components/UISettings.vue'))
const FeatureSwitchSettings = defineAsyncComponent(
  () => import('../components/FeatureSwitchSettings.vue')
)
const MenuBarSettings = defineAsyncComponent(() => import('../components/MenuBarSettings.vue'))
const CustomCSSBlockSettings = defineAsyncComponent(
  () => import('../components/CustomCSSBlockSettings.vue')
)
const EmojiUrlRewriteSettings = defineAsyncComponent(
  () => import('../components/EmojiUrlRewriteSettings.vue')
)
const AISettings = defineAsyncComponent(() => import('../components/AISettings.vue'))
const AIAgentSettings = defineAsyncComponent(() => import('../components/AIAgentSettings.vue'))
const ImgbedSettings = defineAsyncComponent(() => import('../components/ImgbedSettings.vue'))
const SyncSettings = defineAsyncComponent(() => import('../components/SyncSettings.vue'))
const CloudDataPreview = defineAsyncComponent(() => import('../components/CloudDataPreview.vue'))
const CollaborativeUploadSettings = defineAsyncComponent(
  () => import('../components/CollaborativeUploadSettings.vue')
)
const ChatMultiReactorSettings = defineAsyncComponent(
  () => import('../components/ChatMultiReactorSettings.vue')
)
const LinuxDoSeekingSettings = defineAsyncComponent(
  () => import('../components/LinuxDoSeekingSettings.vue')
)
const ScheduledLikesSettings = defineAsyncComponent(
  () => import('../components/ScheduledLikesSettings.vue')
)
const ScheduledBrowseSettings = defineAsyncComponent(
  () => import('../components/ScheduledBrowseSettings.vue')
)
const McpSettings = defineAsyncComponent(() => import('../components/McpSettings.vue'))

import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const options = inject<OptionsInject>('options')!
const { t } = useI18n()
const enableLocalMcpBridge = __ENABLE_LOCAL_MCP_BRIDGE__

const {
  emojiStore,
  localGridColumns,
  updateImageScale,
  updateShowSearchBar,
  updateOutputFormat,
  updateForceMobileMode,
  updateEnableXcomExtraSelectors,
  updateEnableCalloutSuggestions,
  updateEnableBatchParseImages,
  updateEnableExperimentalFeatures,
  updateEnableChatMultiReactor,
  updateChatMultiReactorEmojis,
  updateEnableHoverPreview,
  updateSyncVariantToDisplayUrl,
  updateImageCacheStrategy,
  updateEnableSubmenuInjector,
  updateUseDiscourseNativeUpload,
  updateEnableDiscourseRouterRefresh,
  updateDiscourseRouterRefreshInterval,
  updateEnableLinuxDoSeeking,
  updateLinuxDoSeekingUsers,
  updateEnableLinuxDoSeekingDanmaku,
  updateEnableLinuxDoSeekingSysNotify,
  updateEnableLinuxDoSeekingNtfy,
  updateLinuxDoSeekingNtfyTopic,
  updateLinuxDoSeekingNtfyServer,
  updateLinuxDoSeekingRefreshInterval,
  updateLinuxDoSeekingPosition,
  updateLinuxDoSeekingActionFilter,
  updateEnableLinuxDoCredit,
  updateTheme,
  updateMd3ColorScheme,
  updateMd3SeedColor,
  updateCustomCssBlocks,
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
  updateImdbedApiUrl,
  updateCloudMarketDomain,
  updateEnableTenorSearch,
  updateTenorApiKey,
  updateTenorLocale,
  updateTenorContentFilter
} = options

const activeTab = ref('theme')

// Sync configuration state
const configSaved = ref(false)
const isConfigured = computed(() => {
  return configSaved.value || emojiStore.isSyncConfigured()
})

// Refs for sync components (async-wrapped, instance type erased)
const syncSettingsRef = ref<any>()
const cloudDataPreviewRef = ref<any>()

// Load existing sync config on component mount
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const subtab = params.get('subtab')
  if (subtab) {
    activeTab.value = subtab
  }

  const config: any = await emojiStore.loadSyncConfig()
  if (config) {
    configSaved.value = true
  }
  // Load config in sync settings component
  syncSettingsRef.value?.loadConfig()
})
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
              @update:md3ColorScheme="updateMd3ColorScheme"
              @update:md3SeedColor="updateMd3SeedColor"
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
              @update:enableXcomExtraSelectors="updateEnableXcomExtraSelectors"
              @update:enableCalloutSuggestions="updateEnableCalloutSuggestions"
              @update:enableBatchParseImages="updateEnableBatchParseImages"
              @update:enableExperimentalFeatures="updateEnableExperimentalFeatures"
              @update:imageCacheStrategy="updateImageCacheStrategy"
              @update:enableSubmenuInjector="updateEnableSubmenuInjector"
              @update:useDiscourseNativeUpload="updateUseDiscourseNativeUpload"
              @update:cloudMarketDomain="updateCloudMarketDomain"
              @update:enableDiscourseRouterRefresh="updateEnableDiscourseRouterRefresh"
              @update:discourseRouterRefreshInterval="updateDiscourseRouterRefreshInterval"
              @update:enableTenorSearch="updateEnableTenorSearch"
              @update:tenorApiKey="updateTenorApiKey"
              @update:tenorLocale="updateTenorLocale"
              @update:tenorContentFilter="updateTenorContentFilter"
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
            <CustomCSSBlockSettings
              :settings="emojiStore.settings"
              @update:customCssBlocks="updateCustomCssBlocks"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="url-rewrite" tab="URL 批改">
          <div class="py-4">
            <EmojiUrlRewriteSettings />
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
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="ai-agent" tab="AI Agent">
          <div class="py-4">
            <AIAgentSettings />
          </div>
        </a-tab-pane>

        <a-tab-pane key="imgbed" tab="图床 API">
          <div class="py-4">
            <ImgbedSettings
              :settings="emojiStore.settings"
              @update:imgbedToken="updateImdbedToken"
              @update:imgbedApiUrl="updateImdbedApiUrl"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="sync" tab="云同步">
          <div class="py-4">
            <SyncSettings ref="syncSettingsRef" :options="options" :isConfigured="isConfigured" />

            <!-- Preview Cloud Data Button -->
            <div
              class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
              v-if="isConfigured"
            >
              <div class="flex items-center justify-between">
                <h3 class="text-md font-medium dark:text-white">云端数据预览</h3>
                <a-button
                  @click="cloudDataPreviewRef?.previewCloudData()"
                  :disabled="!isConfigured"
                >
                  预览云端数据
                </a-button>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="collaborative" tab="联动上传">
          <div class="py-4">
            <CollaborativeUploadSettings />
          </div>
        </a-tab-pane>

        <a-tab-pane
          v-if="emojiStore.settings.enableExperimentalFeatures"
          key="experimentalFeatures"
          tab="试验性特性"
        >
          <div class="py-4 space-y-6">
            <ChatMultiReactorSettings
              :settings="emojiStore.settings"
              @update:enableChatMultiReactor="updateEnableChatMultiReactor"
              @update:chatMultiReactorEmojis="updateChatMultiReactorEmojis"
              @update:enableLinuxDoLikeCounter="
                (v: boolean) => emojiStore.updateSettings({ enableLinuxDoLikeCounter: v })
              "
            />
            <ScheduledLikesSettings
              :settings="emojiStore.settings"
              @update:enableScheduledLikes="
                (v: boolean) => emojiStore.updateSettings({ enableScheduledLikes: v })
              "
              @update:scheduledLikeTasks="
                (v: any[]) => emojiStore.updateSettings({ scheduledLikeTasks: v })
              "
            />
            <ScheduledBrowseSettings
              :settings="emojiStore.settings"
              @update:enableScheduledBrowse="
                (v: boolean) => emojiStore.updateSettings({ enableScheduledBrowse: v })
              "
              @update:scheduledBrowseTasks="
                (v: any[]) => emojiStore.updateSettings({ scheduledBrowseTasks: v })
              "
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="linuxdo-seeking" tab="LinuxDo 追觅">
          <div class="py-4">
            <LinuxDoSeekingSettings
              :settings="emojiStore.settings"
              @update:enableLinuxDoSeeking="updateEnableLinuxDoSeeking"
              @update:linuxDoSeekingUsers="updateLinuxDoSeekingUsers"
              @update:enableLinuxDoSeekingDanmaku="updateEnableLinuxDoSeekingDanmaku"
              @update:enableLinuxDoSeekingSysNotify="updateEnableLinuxDoSeekingSysNotify"
              @update:enableLinuxDoSeekingNtfy="updateEnableLinuxDoSeekingNtfy"
              @update:linuxDoSeekingNtfyTopic="updateLinuxDoSeekingNtfyTopic"
              @update:linuxDoSeekingNtfyServer="updateLinuxDoSeekingNtfyServer"
              @update:linuxDoSeekingRefreshInterval="updateLinuxDoSeekingRefreshInterval"
              @update:linuxDoSeekingPosition="updateLinuxDoSeekingPosition"
              @update:linuxDoSeekingActionFilter="updateLinuxDoSeekingActionFilter"
              @update:enableLinuxDoCredit="updateEnableLinuxDoCredit"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane v-if="enableLocalMcpBridge" key="mcp" tab="MCP">
          <div class="py-4">
            <McpSettings />
          </div>
        </a-tab-pane>

        <a-tab-pane key="language" tab="语言设置">
          <div class="py-4">
            <div class="mb-4">
              <h3 class="text-lg font-medium mb-2 dark:text-white">{{ t('settings') }}</h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                选择界面显示语言。更改后需要重新加载页面生效。
              </p>
              <div class="flex items-center gap-4">
                <span class="text-gray-700 dark:text-gray-300">{{ t('settings') }}:</span>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- Cloud Data Preview Component -->
    <CloudDataPreview ref="cloudDataPreviewRef" :options="options" :isConfigured="isConfigured" />
  </div>
</template>
