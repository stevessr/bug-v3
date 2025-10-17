<script setup lang="ts">
import { ref, watch, isRef, type Ref } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

import type { AppSettings } from '../../types/emoji'

import ThemeColorPicker from './ThemeColorPicker.vue'
import SettingSwitch from './SettingSwitch.vue'

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
  'update:enableCalloutSuggestions',
  'update:enableBatchParseImages',
  'update:theme',
  'update:customPrimaryColor',
  'update:customColorScheme',
  'update:enableHoverPreview',
  'update:syncVariantToDisplayUrl',
  'update:customCss'
])

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

// local reactive copies for custom theme colors
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

// Custom color handlers
const handleCustomPrimaryColorUpdate = (color: string) => {
  localCustomPrimaryColor.value = color
  emit('update:customPrimaryColor', color)
}

const handleCustomColorSchemeUpdate = (scheme: string) => {
  localCustomColorScheme.value = scheme
  emit('update:customColorScheme', scheme)
}

// Use Ant Design slider's afterChange to update settings when drag finishes.
const handleImageScaleChange = (value: number | number[]) => {
  const num = Array.isArray(value) ? value[0] : value
  // emit immediately so UI updates take effect while dragging
  setTimeout(() => emit('update:imageScale', num), 0)
}

// Helper function to get setting value
const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    if (isRef(settings)) return (settings.value && settings.value[key]) ?? defaultValue
    return (settings && (settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

// Helper function to handle setting updates
const handleSettingUpdate = (key: string, value: any) => {
  emit(`update:${key}` as any, value)
}

// Custom CSS editor state
const showCustomCssEditor = ref(false)
const _initialCustomCss = (() => {
  try {
    if (isRef(settings)) return (settings.value && settings.value.customCss) || ''
    return (settings && (settings as AppSettings).customCss) || ''
  } catch {
    return ''
  }
})()
const localCustomCss = ref<string>(_initialCustomCss)

watch(
  () => (isRef(settings) ? (settings.value as any).customCss : (settings as AppSettings).customCss),
  v => {
    localCustomCss.value = v || ''
  }
)

const openCustomCssEditor = () => {
  showCustomCssEditor.value = true
}

const saveCustomCss = () => {
  emit('update:customCss', localCustomCss.value || '')
  showCustomCssEditor.value = false
}

const cancelCustomCss = () => {
  // revert local copy
  localCustomCss.value = isRef(settings)
    ? (settings.value as any).customCss || ''
    : (settings as AppSettings).customCss || ''
  showCustomCssEditor.value = false
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">全局设置</h2>
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
          <a-button>
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
          <a-button>
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

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900 dark:text-white">自定义 CSS</label>
          <p class="text-sm text-gray-500 dark:text-white">
            向页面注入自定义 CSS（仅在支持的平台注入）
          </p>
        </div>
        <div>
          <a-button @click="openCustomCssEditor">管理自定义 CSS</a-button>
        </div>
      </div>

      <!-- Custom CSS editor modal (simple) -->
      <div v-if="showCustomCssEditor" class="fixed inset-0 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-3/4 max-w-3xl p-4">
          <h3 class="text-lg font-semibold dark:text-white mb-2">编辑自定义 CSS</h3>
          <textarea
            v-model="localCustomCss"
            rows="10"
            class="w-full p-2 border rounded dark:bg-gray-900 dark:text-white"
          ></textarea>
          <div class="mt-3 flex justify-end gap-2">
            <a-button @click="cancelCustomCss">取消</a-button>
            <a-button type="primary" @click="saveCustomCss">保存并注入</a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
