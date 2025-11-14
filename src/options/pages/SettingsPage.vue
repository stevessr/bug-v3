<script setup lang="ts">
import { inject, ref } from 'vue'

import type { OptionsInject } from '../types'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import GlobalSettings from '../components/GlobalSettings.vue'
import AISettings from '../components/AISettings.vue'

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
  updateCustomOpenAIModel
} = options

const activeTab = ref('general')
</script>

<template>
  <div class="space-y-4">
    <!-- Sub-tabs for settings -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <a-tabs v-model:activeKey="activeTab" class="px-4">
        <a-tab-pane key="general" tab="常规设置">
          <div class="py-4">
            <GlobalSettings
              :settings="emojiStore.settings"
              @update:imageScale="updateImageScale"
              @update:showSearchBar="updateShowSearchBar"
              @update:outputFormat="updateOutputFormat"
              @update:forceMobileMode="updateForceMobileMode"
              @update:enableLinuxDoInjection="updateEnableLinuxDoInjection"
              @update:enableXcomExtraSelectors="updateEnableXcomExtraSelectors"
              @update:enableCalloutSuggestions="updateEnableCalloutSuggestions"
              @update:enableBatchParseImages="updateEnableBatchParseImages"
              @update:enableHoverPreview="updateEnableHoverPreview"
              @update:syncVariantToDisplayUrl="updateSyncVariantToDisplayUrl"
              @update:theme="updateTheme"
              @update:customPrimaryColor="updateCustomPrimaryColor"
              @update:customColorScheme="updateCustomColorScheme"
              @update:customCss="updateCustomCss"
              @update:uploadMenuItems="updateUploadMenuItems"
            >
              <template #grid-selector>
                <GridColumnsSelector v-model="localGridColumns" :min="2" :max="8" :step="1" />
              </template>
            </GlobalSettings>
          </div>
        </a-tab-pane>

        <a-tab-pane key="ai" tab="AI 设置">
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
      </a-tabs>
    </div>
  </div>
</template>
