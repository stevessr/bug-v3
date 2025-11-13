<script setup lang="ts">
import { inject } from 'vue'

import type { OptionsInject } from '../types'
import GridColumnsSelector from '../components/GridColumnsSelector.vue'
import GlobalSettings from '../components/GlobalSettings.vue'

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
  updateGeminiApiKey
} = options
</script>

<template>
  <div class="space-y-8">
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
      @update:geminiApiKey="updateGeminiApiKey"
    >
      <template #grid-selector>
        <GridColumnsSelector v-model="localGridColumns" :min="2" :max="8" :step="1" />
      </template>
    </GlobalSettings>
  </div>
</template>
