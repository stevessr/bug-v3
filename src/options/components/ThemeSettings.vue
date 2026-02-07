<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, computed, toRef, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'
import {
  generatePalettes,
  generateMd3Scheme,
  TONES,
  PALETTES,
  DEFAULT_PRIMARY_COLOR,
  colorSchemes,
  type ThemePalettes,
  type Md3Scheme
} from '../../styles/md3Theme'

import ThemeColorPicker from './ThemeColorPicker.vue'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settingsRef = toRef(props, 'settings')

const resolveSettings = () => {
  const raw = settingsRef.value
  return isRef(raw) ? raw.value : raw
}

const emit = defineEmits(['update:theme', 'update:md3ColorScheme', 'update:md3SeedColor'])

const getTheme = () => {
  try {
    const resolved = resolveSettings()
    return (resolved && resolved.theme) || 'system'
  } catch {
    return 'system'
  }
}

const getMd3ColorScheme = () => {
  try {
    const raw = resolveSettings()?.md3ColorScheme
    // 允许自定义值（不在预设中）
    return raw === undefined ? 'default' : raw
  } catch {
    return 'default'
  }
}

const getMd3SeedColor = () => {
  try {
    const resolved = resolveSettings()
    return resolved ? resolved.md3SeedColor : undefined
  } catch {
    return undefined
  }
}

const localTheme = ref<string>(getTheme())
watch(
  () => getTheme(),
  val => {
    localTheme.value = val || 'system'
  }
)

const localMd3ColorScheme = ref<string>(getMd3ColorScheme())
watch(
  () => getMd3ColorScheme(),
  val => {
    localMd3ColorScheme.value = val === undefined ? 'default' : val
  }
)

const localMd3SeedColor = ref<string | undefined>(getMd3SeedColor())
watch(
  () => getMd3SeedColor(),
  val => {
    localMd3SeedColor.value = val
  }
)

const schemeSeedColor = computed(() => {
  const key = localMd3ColorScheme.value
  // 预设方案优先（避免默认 seed 覆盖预设）
  if (key && Object.prototype.hasOwnProperty.call(colorSchemes, key)) {
    return colorSchemes[key].color
  }

  // 自定义种子色
  if (localMd3SeedColor.value) return localMd3SeedColor.value

  return DEFAULT_PRIMARY_COLOR
})

const handleThemeSelect = (key: string) => {
  localTheme.value = key
  emit('update:theme', key)
}

const handleThemeSelectInfo = (info: { key: string | number }) => {
  handleThemeSelect(String(info.key))
}

const handleMd3ColorSchemeUpdate = (val: string) => {
  // 预设方案才清空自定义种子色；空值用于保留自定义颜色
  if (!val) {
    localMd3ColorScheme.value = ''
    emit('update:md3ColorScheme', '')
    return
  }

  localMd3SeedColor.value = undefined
  emit('update:md3SeedColor', undefined)
  emit('update:md3ColorScheme', val)
}

const handleMd3SeedColorUpdate = (val: string) => {
  localMd3SeedColor.value = val
  // 同时清空本地预设方案状态，确保 UI 立即更新
  localMd3ColorScheme.value = ''
  emit('update:md3SeedColor', val)
  // 清空预设方案选择
  emit('update:md3ColorScheme', '')
}
const showFullPalette = ref(false)

// ============ 调色板预览 ============

// 当前颜色生成的完整调色板
const currentPalettes = computed<ThemePalettes | null>(() => {
  return generatePalettes(schemeSeedColor.value)
})

// MD3 语义颜色预览
const md3Preview = computed<Md3Scheme | null>(() => {
  const mode = localTheme.value === 'dark' ? 'dark' : 'light'
  return generateMd3Scheme(schemeSeedColor.value, mode as 'light' | 'dark')
})

// 调色板名称映射
const paletteLabels: Record<string, string> = {
  primary: '主色',
  secondary: '次色',
  tertiary: '三色',
  error: '错误',
  neutral: '中性',
  'neutral-variant': '中性变体'
}

// 显示的色阶（简化版）
const displayTones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">主题设置</h2>
    </div>
    <div class="p-6 space-y-6">
      <!-- 主题模式选择 -->
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium dark:text-white">主题</label>
          <p class="text-sm text-gray-500 dark:text-gray-400">选择界面主题</p>
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
        <!-- 主题色系选择器 -->
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">主题色系</label>
            <p class="text-sm text-gray-500 dark:text-gray-400">选择 MD3 预设色系</p>
          </div>
          <div class="w-full">
            <ThemeColorPicker
              :md3ColorScheme="localMd3ColorScheme"
              :md3SeedColor="localMd3SeedColor"
              @update:md3ColorScheme="handleMd3ColorSchemeUpdate"
              @update:md3SeedColor="handleMd3SeedColorUpdate"
            />
          </div>
        </div>
      </div>

      <!-- 完整调色板预览 -->
      <div
        v-if="currentPalettes"
        class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium dark:text-white">完整调色板</h3>
          <button
            class="text-xs text-blue-500 hover:text-blue-600"
            @click="showFullPalette = !showFullPalette"
          >
            {{ showFullPalette ? '收起' : '展开全部色阶' }}
          </button>
        </div>

        <!-- 调色板网格 -->
        <div class="space-y-2">
          <div v-for="paletteName in PALETTES" :key="paletteName" class="flex items-center gap-2">
            <span class="w-16 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {{ paletteLabels[paletteName] }}
            </span>
            <div class="flex-1 flex gap-0.5">
              <template v-if="showFullPalette">
                <div
                  v-for="tone in TONES"
                  :key="tone"
                  class="flex-1 h-6 first:rounded-l last:rounded-r"
                  :style="{ backgroundColor: currentPalettes[paletteName][tone] }"
                  :title="`${paletteName}-${tone}: ${currentPalettes[paletteName][tone]}`"
                />
              </template>
              <template v-else>
                <div
                  v-for="tone in displayTones"
                  :key="tone"
                  class="flex-1 h-6 first:rounded-l last:rounded-r"
                  :style="{ backgroundColor: currentPalettes[paletteName][tone] }"
                  :title="`${paletteName}-${tone}: ${currentPalettes[paletteName][tone]}`"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- 色阶标注 -->
        <div class="flex items-center gap-2">
          <span class="w-16 flex-shrink-0"></span>
          <div class="flex-1 flex gap-0.5">
            <template v-if="showFullPalette">
              <div
                v-for="tone in TONES"
                :key="tone"
                class="flex-1 text-center text-[8px] text-gray-400"
              >
                {{ tone }}
              </div>
            </template>
            <template v-else>
              <div
                v-for="tone in displayTones"
                :key="tone"
                class="flex-1 text-center text-[10px] text-gray-400"
              >
                {{ tone }}
              </div>
            </template>
          </div>
        </div>

        <!-- MD3 语义颜色预览 -->
        <div v-if="md3Preview" class="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <h4 class="text-xs font-medium text-gray-600 dark:text-gray-300">
            MD3 语义颜色（{{ localTheme === 'dark' ? '暗色' : '亮色' }}模式）
          </h4>

          <!-- 主要颜色组 -->
          <div class="grid grid-cols-4 gap-1.5">
            <div
              class="h-10 rounded flex flex-col items-center justify-center text-[10px]"
              :style="{ backgroundColor: md3Preview.primary, color: md3Preview.onPrimary }"
            >
              <span class="font-medium">Primary</span>
            </div>
            <div
              class="h-10 rounded flex flex-col items-center justify-center text-[10px]"
              :style="{ backgroundColor: md3Preview.secondary, color: md3Preview.onSecondary }"
            >
              <span class="font-medium">Secondary</span>
            </div>
            <div
              class="h-10 rounded flex flex-col items-center justify-center text-[10px]"
              :style="{ backgroundColor: md3Preview.tertiary, color: md3Preview.onTertiary }"
            >
              <span class="font-medium">Tertiary</span>
            </div>
            <div
              class="h-10 rounded flex flex-col items-center justify-center text-[10px]"
              :style="{ backgroundColor: md3Preview.error, color: md3Preview.onError }"
            >
              <span class="font-medium">Error</span>
            </div>
          </div>

          <!-- 容器颜色组 -->
          <div class="grid grid-cols-4 gap-1.5">
            <div
              class="h-8 rounded flex items-center justify-center text-[9px]"
              :style="{
                backgroundColor: md3Preview.primaryContainer,
                color: md3Preview.onPrimaryContainer
              }"
            >
              Container
            </div>
            <div
              class="h-8 rounded flex items-center justify-center text-[9px]"
              :style="{
                backgroundColor: md3Preview.secondaryContainer,
                color: md3Preview.onSecondaryContainer
              }"
            >
              Container
            </div>
            <div
              class="h-8 rounded flex items-center justify-center text-[9px]"
              :style="{
                backgroundColor: md3Preview.tertiaryContainer,
                color: md3Preview.onTertiaryContainer
              }"
            >
              Container
            </div>
            <div
              class="h-8 rounded flex items-center justify-center text-[9px]"
              :style="{
                backgroundColor: md3Preview.errorContainer,
                color: md3Preview.onErrorContainer
              }"
            >
              Container
            </div>
          </div>

          <!-- Surface 颜色组 -->
          <div class="space-y-1">
            <p class="text-[10px] text-gray-500 dark:text-gray-400">Surface 容器层级</p>
            <div class="flex gap-0.5">
              <div
                class="flex-1 h-8 rounded-l flex items-center justify-center text-[8px]"
                :style="{
                  backgroundColor: md3Preview.surfaceContainerLowest,
                  color: md3Preview.onSurface
                }"
              >
                Lowest
              </div>
              <div
                class="flex-1 h-8 flex items-center justify-center text-[8px]"
                :style="{
                  backgroundColor: md3Preview.surfaceContainerLow,
                  color: md3Preview.onSurface
                }"
              >
                Low
              </div>
              <div
                class="flex-1 h-8 flex items-center justify-center text-[8px]"
                :style="{
                  backgroundColor: md3Preview.surfaceContainer,
                  color: md3Preview.onSurface
                }"
              >
                Default
              </div>
              <div
                class="flex-1 h-8 flex items-center justify-center text-[8px]"
                :style="{
                  backgroundColor: md3Preview.surfaceContainerHigh,
                  color: md3Preview.onSurface
                }"
              >
                High
              </div>
              <div
                class="flex-1 h-8 rounded-r flex items-center justify-center text-[8px]"
                :style="{
                  backgroundColor: md3Preview.surfaceContainerHighest,
                  color: md3Preview.onSurface
                }"
              >
                Highest
              </div>
            </div>
          </div>

          <!-- 其他颜色 -->
          <div class="flex gap-1">
            <div
              class="flex-1 h-6 rounded flex items-center justify-center text-[8px]"
              :style="{ backgroundColor: md3Preview.outline, color: '#fff' }"
            >
              Outline
            </div>
            <div
              class="flex-1 h-6 rounded flex items-center justify-center text-[8px] border"
              :style="{
                backgroundColor: md3Preview.outlineVariant,
                color: md3Preview.onSurface,
                borderColor: md3Preview.outline
              }"
            >
              Outline Variant
            </div>
            <div
              class="flex-1 h-6 rounded flex items-center justify-center text-[8px]"
              :style="{
                backgroundColor: md3Preview.inverseSurface,
                color: md3Preview.inverseOnSurface
              }"
            >
              Inverse
            </div>
          </div>
        </div>

        <!-- CSS 变量说明 -->
        <div class="pt-3 border-t border-gray-100 dark:border-gray-700">
          <details class="text-xs">
            <summary
              class="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              CSS 变量使用说明
            </summary>
            <div
              class="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-gray-600 dark:text-gray-400 space-y-2"
            >
              <p><strong>调色板变量：</strong></p>
              <code class="block bg-gray-100 dark:bg-gray-800 p-1 rounded text-[10px]">
                --palette-{name}-{tone}
                <br />
                例如：var(--palette-primary-40), var(--palette-neutral-90)
              </code>
              <p class="mt-2"><strong>语义变量：</strong></p>
              <code class="block bg-gray-100 dark:bg-gray-800 p-1 rounded text-[10px]">
                --md3-{name} 或 --theme-{name}
                <br />
                例如：var(--md3-primary), var(--theme-surface-container)
              </code>
              <p class="mt-2"><strong>工具类：</strong></p>
              <code class="block bg-gray-100 dark:bg-gray-800 p-1 rounded text-[10px]">
                .bg-md3-primary, .text-md3-on-primary, .border-md3-outline
              </code>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>
