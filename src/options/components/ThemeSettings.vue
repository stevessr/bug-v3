<script setup lang="ts">
import { DownOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { ref, watch, isRef, computed, type Ref } from 'vue'

import type { AppSettings } from '../../types/type'
import {
  generatePalettes,
  generateMd3Scheme,
  TONES,
  PALETTES,
  DEFAULT_PRIMARY_COLOR,
  type ThemePalettes,
  type Md3Scheme
} from '../../styles/md3Theme'

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
    if (isRef(settings))
      return (settings.value && settings.value.customPrimaryColor) || DEFAULT_PRIMARY_COLOR
    return (settings && (settings as AppSettings).customPrimaryColor) || DEFAULT_PRIMARY_COLOR
  } catch {
    return DEFAULT_PRIMARY_COLOR
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
    localCustomPrimaryColor.value = val || DEFAULT_PRIMARY_COLOR
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

// ============ 图片提取相关 ============

const imagePreview = ref<string | null>(null)
const imageSeedColor = ref<string>('')
const imageLoading = ref(false)
const extractedPalette = ref<string[]>([])
const selectedPaletteIndex = ref<number>(0)
const showFullPalette = ref(false)

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`

const hexToRgb = (hex: string) => {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  }
}

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

const getColorScore = (hex: string) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const satScore = hsl.s
  const lightScore = 100 - Math.abs(hsl.l - 50) * 2
  return satScore * 0.7 + lightScore * 0.3
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

// Median Cut 算法
interface ColorBox {
  colors: Array<{ r: number; g: number; b: number }>
  rMin: number
  rMax: number
  gMin: number
  gMax: number
  bMin: number
  bMax: number
}

const createBox = (colors: Array<{ r: number; g: number; b: number }>): ColorBox => {
  let rMin = 255,
    rMax = 0,
    gMin = 255,
    gMax = 0,
    bMin = 255,
    bMax = 0
  for (const c of colors) {
    if (c.r < rMin) rMin = c.r
    if (c.r > rMax) rMax = c.r
    if (c.g < gMin) gMin = c.g
    if (c.g > gMax) gMax = c.g
    if (c.b < bMin) bMin = c.b
    if (c.b > bMax) bMax = c.b
  }
  return { colors, rMin, rMax, gMin, gMax, bMin, bMax }
}

const splitBox = (box: ColorBox): [ColorBox, ColorBox] => {
  const rRange = box.rMax - box.rMin
  const gRange = box.gMax - box.gMin
  const bRange = box.bMax - box.bMin

  let sortKey: 'r' | 'g' | 'b' = 'r'
  if (gRange >= rRange && gRange >= bRange) sortKey = 'g'
  else if (bRange >= rRange && bRange >= gRange) sortKey = 'b'

  const sorted = [...box.colors].sort((a, b) => a[sortKey] - b[sortKey])
  const mid = Math.floor(sorted.length / 2)

  return [createBox(sorted.slice(0, mid)), createBox(sorted.slice(mid))]
}

const getBoxAverage = (box: ColorBox): { r: number; g: number; b: number } => {
  let r = 0,
    g = 0,
    b = 0
  for (const c of box.colors) {
    r += c.r
    g += c.g
    b += c.b
  }
  const len = box.colors.length
  return { r: Math.round(r / len), g: Math.round(g / len), b: Math.round(b / len) }
}

const extractColorPalette = async (dataUrl: string, count: number = 6): Promise<string[]> => {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ['#1890ff']

  const size = 128
  canvas.width = size
  canvas.height = size
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const colors: Array<{ r: number; g: number; b: number }> = []
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 128) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const brightness = (r + g + b) / 3
    if (brightness < 20 || brightness > 235) continue

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.15) continue

    colors.push({ r, g, b })
  }

  if (colors.length === 0) return ['#1890ff']

  const boxes: ColorBox[] = [createBox(colors)]

  while (boxes.length < count * 2) {
    let maxVolume = 0
    let maxIndex = 0
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]
      const volume =
        (box.rMax - box.rMin) * (box.gMax - box.gMin) * (box.bMax - box.bMin) * box.colors.length
      if (volume > maxVolume) {
        maxVolume = volume
        maxIndex = i
      }
    }

    if (boxes[maxIndex].colors.length < 2) break

    const [box1, box2] = splitBox(boxes[maxIndex])
    boxes.splice(maxIndex, 1, box1, box2)
  }

  const palette = boxes.map(box => {
    const avg = getBoxAverage(box)
    return rgbToHex(avg.r, avg.g, avg.b)
  })

  const uniquePalette = [...new Set(palette)]
  uniquePalette.sort((a, b) => getColorScore(b) - getColorScore(a))

  return uniquePalette.slice(0, count)
}

// ============ 调色板预览 ============

// 当前颜色生成的完整调色板
const currentPalettes = computed<ThemePalettes | null>(() => {
  const color = imageSeedColor.value || localCustomPrimaryColor.value
  if (!color) return null
  return generatePalettes(color)
})

// MD3 语义颜色预览
const md3Preview = computed<Md3Scheme | null>(() => {
  const color = imageSeedColor.value || localCustomPrimaryColor.value
  if (!color) return null
  const mode = localTheme.value === 'dark' ? 'dark' : 'light'
  return generateMd3Scheme(color, mode as 'light' | 'dark')
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

const handleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageLoading.value = true
  extractedPalette.value = []
  selectedPaletteIndex.value = 0
  try {
    const dataUrl = await readFileAsDataUrl(file)
    const palette = await extractColorPalette(dataUrl, 6)
    imagePreview.value = dataUrl
    extractedPalette.value = palette
    if (palette.length > 0) {
      selectPaletteColor(0)
    }
  } finally {
    imageLoading.value = false
    input.value = ''
  }
}

const selectPaletteColor = (index: number) => {
  selectedPaletteIndex.value = index
  const color = extractedPalette.value[index]
  if (color) {
    imageSeedColor.value = color
    localCustomPrimaryColor.value = color
    localCustomColorScheme.value = 'custom'
    emit('update:customPrimaryColor', color)
    emit('update:customColorScheme', 'custom')
  }
}
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
        <!-- 主题颜色选择器 -->
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">主题颜色</label>
            <p class="text-sm text-gray-500 dark:text-gray-400">自定义界面主色调</p>
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

        <!-- 图片提取色彩 -->
        <div class="flex items-start justify-between">
          <div>
            <label class="text-sm font-medium dark:text-white">图片生成（MD3）</label>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              上传图片自动提取色系并生成完整 MD3 调色板
            </p>
          </div>
          <div class="w-2/3 space-y-3">
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-white"
              @change="handleImageUpload"
            />
            <div v-if="imageLoading" class="text-xs text-gray-500 dark:text-gray-400">
              正在分析图片并生成调色板...
            </div>

            <!-- 图片预览和提取的颜色 -->
            <div v-else-if="imagePreview && extractedPalette.length > 0" class="space-y-3">
              <div class="flex items-start gap-4">
                <img
                  :src="imagePreview"
                  alt="theme preview"
                  class="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-600 object-cover flex-shrink-0"
                />
                <div class="flex-1 space-y-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400">点击选择种子颜色：</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="(color, index) in extractedPalette"
                      :key="color"
                      class="w-8 h-8 rounded-lg border-2 transition-all duration-200 flex items-center justify-center hover:scale-110"
                      :class="[
                        selectedPaletteIndex === index
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                      ]"
                      :style="{ backgroundColor: color }"
                      :title="color"
                      @click="selectPaletteColor(index)"
                    >
                      <CheckOutlined
                        v-if="selectedPaletteIndex === index"
                        class="text-white drop-shadow-md text-xs"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
