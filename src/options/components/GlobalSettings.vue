'''<script setup lang="ts">
import { ref, watch, isRef, type Ref } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

import type { AppSettings } from '../../types/emoji'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
// allow flexible typing (either a reactive ref or a plain object)
const settings = props.settings as AppSettings | Ref<AppSettings>
const emit = defineEmits([
  'update:imageScale',
  'update:showSearchBar',
  'update:outputFormat',
  'update:forceMobileMode',
  'update:enableLinuxDoInjection',
  'update:enableXcomExtraSelectors',
  'update:theme'
])

// support both ref(settings) and plain settings object
const getOutputFormat = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.outputFormat) || 'markdown'
    return (settings && (settings as AppSettings).outputFormat) || 'markdown'
  } catch {
    return 'markdown'
  }
}

const getTheme = () => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.theme) || 'system'
    return (settings && (settings as AppSettings).theme) || 'system'
  } catch {
    return 'system'
  }
}

// local reactive copy for outputFormat so the select will update when parent props change
const localOutputFormat = ref<string>(getOutputFormat())
watch(
  () => getOutputFormat(),
  val => {
    localOutputFormat.value = val || 'markdown'
  }
)

const localTheme = ref<string>(getTheme())
watch(
  () => getTheme(),
  val => {
    localTheme.value = val || 'system'
  }
)

// local reactive copy for imageScale for smooth drag interaction
const localImageScale = ref<number>(
  (isRef(settings) ? settings.value.imageScale : (settings as AppSettings).imageScale) || 30
)

// Watch for external imageScale changes to keep local state in sync
watch(
  () => (isRef(settings) ? settings.value.imageScale : (settings as AppSettings).imageScale),
  newValue => {
    if (newValue !== localImageScale.value) {
      localImageScale.value = newValue || 30
    }
  }
)

// removed unused handleOutputFormatChange (dropdown is used instead)

const handleOutputFormatSelect = (key: string) => {
  localOutputFormat.value = key
  emit('update:outputFormat', key)
}

const handleThemeSelect = (key: string) => {
  localTheme.value = key
  emit('update:theme', key)
}

const handleOutputFormatSelectInfo = (info: { key: string | number }) => {
  handleOutputFormatSelect(String(info.key))
}

const handleThemeSelectInfo = (info: { key: string | number }) => {
  handleThemeSelect(String(info.key))
}

// Use Ant Design slider's afterChange to update settings when drag finishes.
const handleImageScaleChange = (value: number | number[]) => {
  const num = Array.isArray(value) ? value[0] : value
  // emit immediately so UI updates take effect while dragging
  setTimeout(() => emit('update:imageScale', num), 0)
}

const handleShowSearchBarChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:showSearchBar', target.checked)
}

const handleForceMobileModeChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:forceMobileMode', target.checked)
}

const handleLinuxDoInjectionChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:enableLinuxDoInjection', target.checked)
}

const handleXcomExtraSelectorsChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:enableXcomExtraSelectors', target.checked)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border">
    <div class="px-6 py-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900">全局设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">主题</label>
          <p class="text-sm text-gray-500">选择界面主题</p>
        </div>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleThemeSelectInfo">
              <a-menu-item key="system">跟随系统</a-menu-item>
              <a-menu-item key="light">亮色模式</a-menu-item>
              <a-menu-item key="dark">暗色模式</a-menu-item>
            </a-menu>
          </template>
          <AButton>
            {{ localTheme === 'system' ? '跟随系统' : localTheme === 'light' ? '亮色模式' : '暗色模式' }}
            <DownOutlined />
          </AButton>
        </a-dropdown>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">默认图片缩放</label>
          <p class="text-sm text-gray-500">控制插入表情的默认尺寸</p>
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
          />
          <span class="text-sm text-gray-600 w-12">{{ localImageScale }}%</span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">网格列数</label>
          <p class="text-sm text-gray-500">表情选择器中的列数</p>
        </div>
        <slot name="grid-selector"></slot>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">显示搜索栏</label>
          <p class="text-sm text-gray-500">在表情选择器中显示搜索功能</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settings.showSearchBar"
            @change="handleShowSearchBarChange"
            class="sr-only peer"
          />
          <div
            class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
          ></div>
        </label>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">输出格式</label>
          <p class="text-sm text-gray-500">插入表情时使用的格式</p>
        </div>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleOutputFormatSelectInfo">
              <a-menu-item key="markdown">Markdown 格式</a-menu-item>
              <a-menu-item key="html">HTML 格式</a-menu-item>
            </a-menu>
          </template>
          <AButton>
            {{ localOutputFormat === 'markdown' ? 'Markdown 格式' : 'HTML 格式' }}
            <DownOutlined />
          </AButton>
        </a-dropdown>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">强制移动模式</label>
          <p class="text-sm text-gray-500">在桌面端强制使用移动端样式</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settings.forceMobileMode"
            @change="handleForceMobileModeChange"
            class="sr-only peer"
          />
          <div
            class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
          ></div>
        </label>
      </div>

      <div class="flex items-center justify-between" v-if="false">
        <div>
          <label class="text-sm font-medium text-gray-900">启用Linux.do脚本注入</label>
          <p class="text-sm text-gray-500">控制是否在linux.do注入表情功能脚本</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settings.enableLinuxDoInjection"
            @change="handleLinuxDoInjectionChange"
            class="sr-only peer"
          />
          <div
            class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
          ></div>
        </label>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900">启用X.com额外选择器</label>
          <p class="text-sm text-gray-500">在X.com(Twitter)启用额外的选择器控制</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settings.enableXcomExtraSelectors"
            @change="handleXcomExtraSelectorsChange"
            class="sr-only peer"
          />
          <div
            class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
          ></div>
        </label>
      </div>
    </div>
  </div>
</template>
