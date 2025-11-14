<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'

import SettingSwitch from './SettingSwitch.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits([
  'update:outputFormat',
  'update:forceMobileMode',
  'update:enableLinuxDoInjection',
  'update:enableXcomExtraSelectors',
  'update:enableCalloutSuggestions',
  'update:enableBatchParseImages'
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

const getOutputFormat = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.outputFormat) || 'markdown'
    return (settings && (settings as AppSettings).outputFormat) || 'markdown'
  } catch {
    return 'markdown'
  }
}

const localOutputFormat = ref<string>(getOutputFormat())
watch(
  () => getOutputFormat(),
  val => {
    localOutputFormat.value = val || 'markdown'
  }
)

const handleOutputFormatSelect = (key: string) => {
  localOutputFormat.value = key
  emit('update:outputFormat', key)
}

const handleOutputFormatSelectInfo = (info: { key: string | number }) => {
  handleOutputFormatSelect(String(info.key))
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">功能开关</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">输出格式</label>
          <p class="text-sm dark:text-white">插入表情时使用的格式</p>
        </div>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleOutputFormatSelectInfo">
              <a-menu-item key="markdown">Markdown 格式</a-menu-item>
              <a-menu-item key="html">HTML 格式</a-menu-item>
            </a-menu>
          </template>
          <a-button title="选择输出格式">
            {{ localOutputFormat === 'markdown' ? 'Markdown 格式' : 'HTML 格式' }}
            <DownOutlined />
          </a-button>
        </a-dropdown>
      </div>

      <SettingSwitch
        :model-value="getSetting('forceMobileMode', false)"
        @update:model-value="handleSettingUpdate('forceMobileMode', $event)"
        label="强制移动模式"
        description="在桌面端强制使用移动端样式"
      />

      <SettingSwitch
        :model-value="getSetting('enableLinuxDoInjection', false)"
        @update:model-value="handleSettingUpdate('enableLinuxDoInjection', $event)"
        label="启用 Linux.do 脚本注入"
        description="控制是否在 linux.do 注入表情功能脚本"
        :visible="false"
      />

      <SettingSwitch
        :model-value="getSetting('enableXcomExtraSelectors', false)"
        @update:model-value="handleSettingUpdate('enableXcomExtraSelectors', $event)"
        label="启用 X.com 额外选择器"
        description="在 X.com(Twitter) 启用额外的选择器控制"
      />

      <SettingSwitch
        :model-value="getSetting('enableCalloutSuggestions', false)"
        @update:model-value="handleSettingUpdate('enableCalloutSuggestions', $event)"
        label="启用 Callout 自动补全"
        description="在编辑器中输入 [! 时显示 Callout 语法提示"
      />

      <SettingSwitch
        :model-value="getSetting('enableBatchParseImages', true)"
        @update:model-value="handleSettingUpdate('enableBatchParseImages', $event)"
        label="启用一键解析全部图片"
        description="控制前端是否注入'一键解析并添加所有图片'按钮"
      />
    </div>
  </div>
</template>
