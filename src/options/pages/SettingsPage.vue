<script setup lang="ts">
import { inject, ref } from 'vue'

import type { OptionsInject } from '../types'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import ThemeSettings from '../components/ThemeSettings.vue'
import UISettings from '../components/UISettings.vue'
import FeatureSwitchSettings from '../components/FeatureSwitchSettings.vue'
import MenuBarSettings from '../components/MenuBarSettings.vue'
import CustomCSSSettings from '../components/CustomCSSSettings.vue'
import AISettings from '../components/AISettings.vue'
import CloudSyncSettings from '../components/CloudSyncSettings.vue'

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
  updateGeminiLanguage,
  updateGeminiModel,
  updateUseCustomOpenAI,
  updateCustomOpenAIEndpoint,
  updateCustomOpenAIKey,
  updateCustomOpenAIModel,
  showSuccess,
  showError
} = options

const activeTab = ref('theme')
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
              @update:geminiLanguage="updateGeminiLanguage"
              @update:geminiModel="updateGeminiModel"
              @update:useCustomOpenAI="updateUseCustomOpenAI"
              @update:customOpenAIEndpoint="updateCustomOpenAIEndpoint"
              @update:customOpenAIKey="updateCustomOpenAIKey"
              @update:customOpenAIModel="updateCustomOpenAIModel"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="sync" tab="云同步">
          <div class="py-4">
            <CloudSyncSettings
              :settings="emojiStore.settings"
              :emojiStore="emojiStore"
              :showSuccess="showSuccess"
              :showError="showError"
            />
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>
