<script setup lang="ts">
import { ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

import SettingSwitch from './SettingSwitch.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits([
  'update:imageScale',
  'update:showSearchBar',
  'update:enableHoverPreview',
  'update:syncVariantToDisplayUrl',
  'update:highContrastMode',
  'update:reduceMotion'
])

const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    if (isRef(settings)) return (settings.value && settings.value[key]) ?? defaultValue
    return (settings && (settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

const handleSettingUpdate = (key: string, value: any) => {
  emit(`update:${key}` as any, value)
}

// Image scale
const localImageScale = ref<number>(
  (isRef(settings) ? settings.value.imageScale : (settings as AppSettings).imageScale) || 30
)

watch(
  () => (isRef(settings) ? settings.value.imageScale : (settings as AppSettings).imageScale),
  newValue => {
    if (newValue !== localImageScale.value) {
      localImageScale.value = newValue || 30
    }
  }
)

const handleImageScaleChange = () => {
  emit('update:imageScale', localImageScale.value)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">界面设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">默认图片缩放</label>
          <p class="text-sm dark:text-white">控制插入表情的默认尺寸</p>
        </div>
        <div class="flex items-center gap-3">
          <ASlider
            id="imageScaleSlider"
            v-model:value="localImageScale"
            :min="5"
            :max="150"
            :step="5"
            class="w-32"
            @change="handleImageScaleChange"
            title="默认图片缩放比例"
          />
          <span class="text-sm text-gray-600 dark:text-white w-12">{{ localImageScale }}%</span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">网格列数</label>
          <p class="text-sm dark:text-white">表情选择器中的列数</p>
        </div>
        <slot name="grid-selector"></slot>
      </div>

      <SettingSwitch
        :model-value="getSetting('showSearchBar', false)"
        @update:model-value="handleSettingUpdate('showSearchBar', $event)"
        label="显示搜索栏"
        description="在表情选择器中显示搜索功能"
      />

      <SettingSwitch
        :model-value="getSetting('enableHoverPreview', false)"
        @update:model-value="handleSettingUpdate('enableHoverPreview', $event)"
        label="悬浮预览"
        description="在表情选择器中启用鼠标悬浮显示大图预览"
      />

      <SettingSwitch
        :model-value="getSetting('syncVariantToDisplayUrl', true)"
        @update:model-value="handleSettingUpdate('syncVariantToDisplayUrl', $event)"
        label="导入时同步变体到显示图"
        description="当选择导入变体时，是否将该变体 URL 同步为项的 displayUrl（用于缩略图显示）"
      />

      <SettingSwitch
        :model-value="getSetting('highContrastMode', false)"
        @update:model-value="handleSettingUpdate('highContrastMode', $event)"
        label="高对比度模式"
        description="增强界面元素的颜色对比度，提高可读性"
      />

      <SettingSwitch
        :model-value="getSetting('reduceMotion', false)"
        @update:model-value="handleSettingUpdate('reduceMotion', $event)"
        label="减少动画"
        description="减少界面动画效果，提高性能和可访问性"
      />
    </div>
  </div>
</template>
