<script setup lang="ts">
import { inject, ref, computed, onMounted } from 'vue'

import type { OptionsInject } from '../types'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import ThemeSettings from '../components/ThemeSettings.vue'
import UISettings from '../components/UISettings.vue'
import FeatureSwitchSettings from '../components/FeatureSwitchSettings.vue'
import MenuBarSettings from '../components/MenuBarSettings.vue'
import CustomCSSBlockSettings from '../components/CustomCSSBlockSettings.vue'
import AISettings from '../components/AISettings.vue'
import AIAgentSettings from '../components/AIAgentSettings.vue'
import ImgbedSettings from '../components/ImgbedSettings.vue'
import SyncSettings from '../components/SyncSettings.vue'
import CloudDataPreview from '../components/CloudDataPreview.vue'
import CollaborativeUploadSettings from '../components/CollaborativeUploadSettings.vue'
import ChatMultiReactorSettings from '../components/ChatMultiReactorSettings.vue'
import LinuxDoSeekingSettings from '../components/LinuxDoSeekingSettings.vue'
import ScheduledLikesSettings from '../components/ScheduledLikesSettings.vue'
import ScheduledBrowseSettings from '../components/ScheduledBrowseSettings.vue'

import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const options = inject<OptionsInject>('options')!
const { t } = useI18n()

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
  updateUseIndexedDBForImages,
  updateEnableContentImageCache,
  updateEnableSubmenuInjector,
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
  updateCustomPrimaryColor,
  updateCustomColorScheme,
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
  updateCloudMarketDomain
} = options

const activeTab = ref('theme')

// Sync configuration state
const configSaved = ref(false)
const isConfigured = computed(() => {
  return configSaved.value || emojiStore.isSyncConfigured()
})

// Refs for sync components
const syncSettingsRef = ref<InstanceType<typeof SyncSettings>>()
const cloudDataPreviewRef = ref<InstanceType<typeof CloudDataPreview>>()

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
              @update:enableXcomExtraSelectors="updateEnableXcomExtraSelectors"
              @update:enableCalloutSuggestions="updateEnableCalloutSuggestions"
              @update:enableBatchParseImages="updateEnableBatchParseImages"
              @update:enableExperimentalFeatures="updateEnableExperimentalFeatures"
              @update:useIndexedDBForImages="updateUseIndexedDBForImages"
              @update:enableContentImageCache="updateEnableContentImageCache"
              @update:enableSubmenuInjector="updateEnableSubmenuInjector"
              @update:cloudMarketDomain="updateCloudMarketDomain"
              @update:enableDiscourseRouterRefresh="updateEnableDiscourseRouterRefresh"
              @update:discourseRouterRefreshInterval="updateDiscourseRouterRefreshInterval"
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
