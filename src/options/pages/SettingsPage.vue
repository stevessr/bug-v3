<script setup lang="ts">
import { inject, ref, computed, onMounted } from 'vue'

import type { OptionsInject } from '../types'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import ThemeSettings from '../components/ThemeSettings.vue'
import UISettings from '../components/UISettings.vue'
import FeatureSwitchSettings from '../components/FeatureSwitchSettings.vue'
import MenuBarSettings from '../components/MenuBarSettings.vue'
import CustomCSSBlockSettings from '../components/CustomCSSBlockSettings.vue'
import AutoDownloadSettings from '../components/AutoDownloadSettings.vue'
import AISettings from '../components/AISettings.vue'
import SyncSettings from '../components/SyncSettings.vue'
import CloudDataPreview from '../components/CloudDataPreview.vue'

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
  updateUseIndexedDBForImages,
  updateTheme,
  updateCustomPrimaryColor,
  updateCustomColorScheme,
  updateCustomCss,
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
  updateEnableAutoDownload,
  updateAutoDownloadSuffixes
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
              @update:enableLinuxDoInjection="updateEnableLinuxDoInjection"
              @update:enableXcomExtraSelectors="updateEnableXcomExtraSelectors"
              @update:enableCalloutSuggestions="updateEnableCalloutSuggestions"
              @update:enableBatchParseImages="updateEnableBatchParseImages"
              @update:useIndexedDBForImages="updateUseIndexedDBForImages"
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
              @update:customCss="updateCustomCss"
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
              @update:imgbedToken="updateImdbedToken"
              @update:imgbedApiUrl="updateImdbedApiUrl"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="autodownload" tab="自动下载">
          <div class="py-4">
            <AutoDownloadSettings
              :settings="emojiStore.settings"
              @update:enableAutoDownload="updateEnableAutoDownload"
              @update:autoDownloadSuffixes="updateAutoDownloadSuffixes"
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
      </a-tabs>
    </div>

    <!-- Cloud Data Preview Component -->
    <CloudDataPreview ref="cloudDataPreviewRef" :options="options" :isConfigured="isConfigured" />
  </div>
</template>
