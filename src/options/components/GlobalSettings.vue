<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, type Ref } from 'vue'
import { reactive } from 'vue'

import type { AppSettings } from '../../types/type'

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
  'update:customCss',
  'update:uploadMenuItems',
  'update:geminiApiKey'
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

// Helper function to get setting value (moved up so it's available before top-level refs use it)
const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    if (isRef(settings)) return (settings.value && settings.value[key]) ?? defaultValue
    return (settings && (settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

// Helper function to handle setting updates (also moved up to avoid ordering issues)
const handleSettingUpdate = async (key: string, value: any) => {
  try {
    await emit(`update:${key}` as any, value)
  } catch (error) {
    console.error(`[GlobalSettings] Failed to update setting ${key}:`, error)
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

// localGeminiApiKey now safely uses getSetting which is already declared
const localGeminiApiKey = ref<string>(getSetting('geminiApiKey', ''))
watch(
  () => getSetting('geminiApiKey', ''),
  (val: string) => {
    localGeminiApiKey.value = val
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

const handleOutputFormatSelect = async (key: string) => {
  localOutputFormat.value = key
  try {
    await emit('update:outputFormat', key)
  } catch (error) {
    console.error('[GlobalSettings] Failed to update outputFormat:', error)
  }
}

const handleThemeSelect = async (key: string) => {
  localTheme.value = key
  try {
    await emit('update:theme', key)
  } catch (error) {
    console.error('[GlobalSettings] Failed to update theme:', error)
  }
}

const handleOutputFormatSelectInfo = (info: { key: string | number }) => {
  handleOutputFormatSelect(String(info.key))
}

const handleThemeSelectInfo = (info: { key: string | number }) => {
  handleThemeSelect(String(info.key))
}

// Custom color handlers
const handleCustomPrimaryColorUpdate = async (color: string) => {
  localCustomPrimaryColor.value = color
  try {
    await emit('update:customPrimaryColor', color)
  } catch (error) {
    console.error('[GlobalSettings] Failed to update customPrimaryColor:', error)
  }
}

const handleCustomColorSchemeUpdate = async (scheme: string) => {
  localCustomColorScheme.value = scheme
  try {
    await emit('update:customColorScheme', scheme)
  } catch (error) {
    console.error('[GlobalSettings] Failed to update customColorScheme:', error)
  }
}

// Use Ant Design slider's afterChange to update settings when drag finishes.
const handleImageScaleChange = async (value: number | number[]) => {
  const num = Array.isArray(value) ? value[0] : value
  // emit immediately so UI updates take effect while dragging
  try {
    setTimeout(async () => {
      try {
        await emit('update:imageScale', num)
      } catch (error) {
        console.error('[GlobalSettings] Failed to update imageScale:', error)
      }
    }, 0)
  } catch (error) {
    console.error('[GlobalSettings] Failed to handle imageScale change:', error)
  }
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

const saveCustomCss = async () => {
  try {
    await emit('update:customCss', localCustomCss.value || '')
    showCustomCssEditor.value = false
  } catch (error) {
    console.error('[GlobalSettings] Failed to save custom CSS:', error)
  }
}

const cancelCustomCss = () => {
  // revert local copy
  localCustomCss.value = isRef(settings)
    ? (settings.value as any).customCss || ''
    : (settings as AppSettings).customCss || ''
  showCustomCssEditor.value = false
}

// --- uploadMenuItems editor ---
const getUploadMenuItems = () => {
  try {
    if (isRef(settings)) return (settings.value && (settings.value as any).uploadMenuItems) || null
    return (settings && (settings as AppSettings).uploadMenuItems) || null
  } catch {
    return null
  }
}

const _initialUploadMenuItems = getUploadMenuItems() || {
  autoItems: [],
  iframes: [],
  sides: []
}

const localUploadMenuItems = reactive<any>({
  autoItems: Array.isArray(_initialUploadMenuItems.autoItems)
    ? JSON.parse(JSON.stringify(_initialUploadMenuItems.autoItems))
    : [],
  iframes: Array.isArray(_initialUploadMenuItems.iframes)
    ? JSON.parse(JSON.stringify(_initialUploadMenuItems.iframes))
    : [],
  sides: Array.isArray(_initialUploadMenuItems.sides)
    ? JSON.parse(JSON.stringify(_initialUploadMenuItems.sides))
    : []
})

watch(
  () => getUploadMenuItems(),
  v => {
    const val = v || { autoItems: [], iframes: [], sides: [] }
    localUploadMenuItems.autoItems = Array.isArray(val.autoItems)
      ? JSON.parse(JSON.stringify(val.autoItems))
      : []
    localUploadMenuItems.iframes = Array.isArray(val.iframes)
      ? JSON.parse(JSON.stringify(val.iframes))
      : []
    localUploadMenuItems.sides = Array.isArray(val.sides)
      ? JSON.parse(JSON.stringify(val.sides))
      : []
  }
)

const dirty = ref(false)

const markDirty = () => {
  dirty.value = true
}

const emitUploadMenuItems = async () => {
  // Emit the entire structure when user clicks 保存
  try {
    await emit('update:uploadMenuItems', {
      autoItems: localUploadMenuItems.autoItems,
      iframes: localUploadMenuItems.iframes,
      sides: localUploadMenuItems.sides
    })
  } catch (error) {
    console.error('[GlobalSettings] Failed to update uploadMenuItems:', error)
  }
}

const saveUploadMenuItems = async () => {
  await emitUploadMenuItems()
  dirty.value = false
}

const cancelUploadMenuItems = () => {
  // Revert local copy to current settings from parent
  const val = getUploadMenuItems() || { autoItems: [], iframes: [], sides: [] }
  localUploadMenuItems.autoItems = Array.isArray(val.autoItems)
    ? JSON.parse(JSON.stringify(val.autoItems))
    : []
  localUploadMenuItems.iframes = Array.isArray(val.iframes)
    ? JSON.parse(JSON.stringify(val.iframes))
    : []
  localUploadMenuItems.sides = Array.isArray(val.sides) ? JSON.parse(JSON.stringify(val.sides)) : []
  dirty.value = false
}

const addAutoItem = () => {
  localUploadMenuItems.autoItems.push(['新项', '🔗', 'https://example.com'])
  markDirty()
}
const removeAutoItem = (i: number) => {
  localUploadMenuItems.autoItems.splice(i, 1)
  markDirty()
}

const addIframeItem = () => {
  localUploadMenuItems.iframes.push(['新 iframe', '🌐', 'https://example.com', ''])
  markDirty()
}
const removeIframeItem = (i: number) => {
  localUploadMenuItems.iframes.splice(i, 1)
  markDirty()
}

const addSideItem = () => {
  localUploadMenuItems.sides.push(['新 侧边', '📎', 'https://example.com', ''])
  markDirty()
}
const removeSideItem = (i: number) => {
  localUploadMenuItems.sides.splice(i, 1)
  markDirty()
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

      <!-- Gemini API Configuration -->
      <div class="pt-4 border-t">
        <h3 class="text-sm font-medium dark:text-white mb-2">Gemini API 配置</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          配置 Google Gemini API 以启用智能表情命名和相似度检测功能
        </p>
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium dark:text-white min-w-[100px]">API Key:</label>
          <input
            v-model="localGeminiApiKey"
            type="password"
            class="border rounded px-3 py-2 flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @change="handleSettingUpdate('geminiApiKey', localGeminiApiKey)"
            placeholder="输入你的 Gemini API Key"
            title="Gemini API Key"
          />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          获取 API Key:
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            class="text-blue-500 hover:underline"
          >
            Google AI Studio
          </a>
        </p>
      </div>

      <!-- Upload menu items editor -->
      <div class="pt-4 border-t">
        <h3 class="text-sm font-medium dark:text-white">上传菜单项（高级）</h3>
        <p class="text-sm dark:text-white mb-2">
          管理上传菜单和 iframe / 侧边链接（保存后会同步到后台）
        </p>

        <!-- Auto items -->
        <div class="mb-3">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium dark:text-white">自动项 (autoItems)</div>
            <a-button size="small" @click="addAutoItem" title="添加自动项">添加</a-button>
          </div>
          <div
            v-for="(item, i) in localUploadMenuItems.autoItems"
            :key="'auto-' + i"
            class="flex gap-2 items-center mb-2"
          >
            <input
              class="border rounded px-2 py-1 flex-1"
              :value="item[0]"
              @input="
                e => {
                  localUploadMenuItems.autoItems[i][0] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'自动项名称 ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 w-20"
              :value="item[1]"
              @input="
                e => {
                  localUploadMenuItems.autoItems[i][1] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'自动项图标 ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 flex-1"
              :value="item[2]"
              @input="
                e => {
                  localUploadMenuItems.autoItems[i][2] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'自动项 URL ' + (i + 1)"
            />
            <a-button
              size="small"
              type="danger"
              @click="removeAutoItem(i)"
              :title="'删除第 ' + (i + 1) + ' 项'"
            >
              删除
            </a-button>
          </div>
        </div>

        <!-- Iframes -->
        <div class="mb-3">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium dark:text-white">Iframe 模态 (iframes)</div>
            <a-button size="small" @click="addIframeItem" title="添加 Iframe 模态项">添加</a-button>
          </div>
          <div
            v-for="(item, i) in localUploadMenuItems.iframes"
            :key="'iframe-' + i"
            class="flex gap-2 items-center mb-2"
          >
            <input
              class="border rounded px-2 py-1 w-40"
              :value="item[0]"
              @input="
                e => {
                  localUploadMenuItems.iframes[i][0] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'Iframe 模态名称 ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 w-16"
              :value="item[1]"
              @input="
                e => {
                  localUploadMenuItems.iframes[i][1] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'Iframe 模态图标 ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 flex-1"
              :value="item[2]"
              @input="
                e => {
                  localUploadMenuItems.iframes[i][2] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'Iframe 模态 URL ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 w-48"
              :value="item[3]"
              placeholder="className"
              @input="
                e => {
                  localUploadMenuItems.iframes[i][3] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'Iframe 模态 CSS 类名 ' + (i + 1)"
            />
            <a-button
              size="small"
              type="danger"
              @click="removeIframeItem(i)"
              :title="'删除第 ' + (i + 1) + ' 项'"
            >
              删除
            </a-button>
          </div>
        </div>

        <!-- Sides -->
        <div class="mb-3">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium dark:text-white">侧边 iframe (sides)</div>
            <a-button size="small" @click="addSideItem" title="添加侧边 Iframe 项">添加</a-button>
          </div>
          <div
            v-for="(item, i) in localUploadMenuItems.sides"
            :key="'side-' + i"
            class="flex gap-2 items-center mb-2"
          >
            <input
              class="border rounded px-2 py-1 w-40"
              :value="item[0]"
              @input="
                e => {
                  localUploadMenuItems.sides[i][0] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'侧边 iframe 名称 ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 w-16"
              :value="item[1]"
              @input="
                e => {
                  localUploadMenuItems.sides[i][1] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'侧边 iframe 图标 ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 flex-1"
              :value="item[2]"
              @input="
                e => {
                  localUploadMenuItems.sides[i][2] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'侧边 iframe URL ' + (i + 1)"
            />
            <input
              class="border rounded px-2 py-1 w-48"
              :value="item[3]"
              placeholder="className"
              @input="
                e => {
                  localUploadMenuItems.sides[i][3] = (e.target as HTMLInputElement).value
                  markDirty()
                }
              "
              :title="'侧边 iframe CSS 类名 ' + (i + 1)"
            />
            <a-button
              size="small"
              type="danger"
              @click="removeSideItem(i)"
              :title="'删除第 ' + (i + 1) + ' 项'"
            >
              删除
            </a-button>
          </div>
        </div>

        <!-- Save / Cancel bar -->
        <div class="flex justify-end gap-2 mt-2">
          <a-button @click="cancelUploadMenuItems" :disabled="!dirty" title="取消上传菜单项更改">
            取消
          </a-button>
          <a-button
            type="primary"
            @click="saveUploadMenuItems"
            :disabled="!dirty"
            title="保存上传菜单项更改"
          >
            保存
          </a-button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-900 dark:text-white">自定义 CSS</label>
          <p class="text-sm text-gray-500 dark:text-white">
            向页面注入自定义 CSS（仅在支持的平台注入）
          </p>
        </div>
        <div>
          <a-button @click="openCustomCssEditor" title="打开自定义 CSS 编辑器">
            管理自定义 CSS
          </a-button>
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
            title="自定义 CSS 内容"
          ></textarea>
          <div class="mt-3 flex justify-end gap-2">
            <a-button @click="cancelCustomCss" title="取消自定义 CSS 更改">取消</a-button>
            <a-button type="primary" @click="saveCustomCss" title="保存并注入自定义 CSS">
              保存并注入
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
