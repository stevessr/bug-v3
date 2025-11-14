<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

import ThemeColorPicker from './ThemeColorPicker.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits(['update:theme', 'update:customPrimaryColor', 'update:customColorScheme'])

const getTheme = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.theme) || 'system'
    return (settings && (settings as AppSettings).theme) || 'system'
  } catch {
    return 'system'
  }
}

const getCustomPrimaryColor = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.customPrimaryColor) || '#1890ff'
    return (settings && (settings as AppSettings).customPrimaryColor) || '#1890ff'
  } catch {
    return '#1890ff'
  }
}

const getCustomColorScheme = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.customColorScheme) || 'default'
    return (settings && (settings as AppSettings).customColorScheme) || 'default'
  } catch {
    return 'default'
  }
}

const localTheme = ref<string>(getTheme())
watch(
  () => getTheme(),
  val => {
    localTheme.value = val || 'system'
  }
)

const localCustomPrimaryColor = ref<string>(getCustomPrimaryColor())
watch(
  () => getCustomPrimaryColor(),
  val => {
    localCustomPrimaryColor.value = val || '#1890ff'
  }
)

const localCustomColorScheme = ref<string>(getCustomColorScheme())
watch(
  () => getCustomColorScheme(),
  val => {
    localCustomColorScheme.value = val || 'default'
  }
)

const handleThemeSelect = (key: string) => {
  localTheme.value = key
  emit('update:theme', key)
}

const handleThemeSelectInfo = (info: { key: string | number }) => {
  handleThemeSelect(String(info.key))
}

const handleCustomPrimaryColorUpdate = (val: string) => {
  emit('update:customPrimaryColor', val)
}

const handleCustomColorSchemeUpdate = (val: string) => {
  emit('update:customColorScheme', val)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">主题设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">主题</label>
          <p class="text-sm dark:text-white">选择界面主题</p>
        </div>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleThemeSelectInfo">
              <a-menu-item key="system">跟随系统</a-menu-item>
              <a-menu-item key="light">亮色模式</a-menu-item>
              <a-menu-item key="dark">暗色模式</a-menu-item>
            </a-menu>
          </template>
          <a-button title="选择主题">
            {{
              localTheme === 'system'
                ? '跟随系统'
                : localTheme === 'light'
                  ? '亮色模式'
                  : '暗色模式'
            }}
            <DownOutlined />
          </a-button>
        </a-dropdown>
      </div>

      <div class="flex flex-col space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">主题颜色</label>
            <p class="text-sm dark:text-white">自定义界面主色调</p>
          </div>
          <div class="w-2/3">
            <ThemeColorPicker
              v-model="localCustomPrimaryColor"
              :colorScheme="localCustomColorScheme"
              @update:modelValue="handleCustomPrimaryColorUpdate"
              @update:colorScheme="handleCustomColorSchemeUpdate"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
