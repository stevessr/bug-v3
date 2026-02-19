/**
 * Material Design 3 主题系统
 * 使用 CSS 变量控制多级颜色
 *
 * 生成完整的色调阶梯（tonal palette）:
 * - primary: 主色调
 * - secondary: 次要色调（色相 +20°）
 * - tertiary: 第三色调（色相 +60°）
 * - error: 错误色（固定红色）
 * - neutral: 中性色（去饱和主色）
 * - neutral-variant: 中性变体色
 *
 * 每个色调包含完整的色阶：0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100
 */

// 色阶定义（MD3 标准色阶）
export const TONES = [
  0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100
] as const
export type Tone = (typeof TONES)[number]

// 调色板名称
export const PALETTES = [
  'primary',
  'secondary',
  'tertiary',
  'error',
  'neutral',
  'neutral-variant'
] as const
export type PaletteName = (typeof PALETTES)[number]

// 完整的色调调色板
export type TonalPalette = Record<Tone, string>

// 完整的主题调色板集合
export type ThemePalettes = Record<PaletteName, TonalPalette>

// MD3 语义颜色方案
export type Md3Scheme = Record<string, string>

export const DEFAULT_PRIMARY_COLOR = '#6750A4' // MD3 默认紫色

// ============ 经典配色方案 ============

/**
 * 配色方案分类
 */
export type ColorSchemeCategory =
  | 'classic' // 经典配色
  | 'morandi' // 莫兰迪色系
  | 'macaron' // 马卡龙色系
  | 'natural' // 自然色系
  | 'modern' // 现代色系
  | 'retro' // 复古色系

/**
 * 配色方案定义
 */
export interface ColorSchemeDefinition {
  name: string // 显示名称
  color: string // 主色
  category: ColorSchemeCategory
  description?: string // 描述
}

/**
 * 完整的配色方案库
 * 包含莫兰迪、马卡龙、自然、现代、复古等多种风格
 */
export const colorSchemes: Record<string, ColorSchemeDefinition> = {
  // ============ 经典配色 ============
  default: {
    name: '默认紫',
    color: '#6750A4',
    category: 'classic',
    description: 'Material Design 3 默认主题色'
  },
  blue: {
    name: '经典蓝',
    color: '#1976D2',
    category: 'classic',
    description: '沉稳专业的蓝色'
  },
  indigo: {
    name: '靛蓝',
    color: '#3F51B5',
    category: 'classic',
    description: '深邃的靛蓝色'
  },
  teal: {
    name: '青色',
    color: '#009688',
    category: 'classic',
    description: '清新的青绿色'
  },

  // ============ 莫兰迪色系 ============
  // 莫兰迪色系特点：低饱和度、柔和灰调、高级感
  morandiGray: {
    name: '莫兰迪灰',
    color: '#8D99AE',
    category: 'morandi',
    description: '经典莫兰迪灰蓝调'
  },
  morandiPink: {
    name: '莫兰迪粉',
    color: '#C9ADA7',
    category: 'morandi',
    description: '温柔的灰粉色'
  },
  morandiGreen: {
    name: '莫兰迪绿',
    color: '#A3B18A',
    category: 'morandi',
    description: '低调的橄榄绿'
  },
  morandiBlue: {
    name: '莫兰迪蓝',
    color: '#7B9EA8',
    category: 'morandi',
    description: '宁静的灰蓝色'
  },
  morandiPurple: {
    name: '莫兰迪紫',
    color: '#9D8189',
    category: 'morandi',
    description: '复古的灰紫调'
  },
  morandiBrown: {
    name: '莫兰迪棕',
    color: '#A39081',
    category: 'morandi',
    description: '温暖的灰棕色'
  },

  // ============ 马卡龙色系 ============
  // 马卡龙色系特点：粉嫩、甜美、高明度
  macaronPink: {
    name: '马卡龙粉',
    color: '#FFB6C1',
    category: 'macaron',
    description: '甜美的樱花粉'
  },
  macaronMint: {
    name: '马卡龙薄荷',
    color: '#98D8C8',
    category: 'macaron',
    description: '清新的薄荷绿'
  },
  macaronLavender: {
    name: '马卡龙薰衣草',
    color: '#E6E6FA',
    category: 'macaron',
    description: '浪漫的薰衣草紫'
  },
  macaronLemon: {
    name: '马卡龙柠檬',
    color: '#FFFACD',
    category: 'macaron',
    description: '明亮的柠檬黄'
  },
  macaronPeach: {
    name: '马卡龙蜜桃',
    color: '#FFDAB9',
    category: 'macaron',
    description: '温暖的蜜桃色'
  },
  macaronSky: {
    name: '马卡龙天蓝',
    color: '#87CEEB',
    category: 'macaron',
    description: '清澈的天空蓝'
  },

  // ============ 自然色系 ============
  sage: {
    name: '鼠尾草绿',
    color: '#9CAF88',
    category: 'natural',
    description: '自然草本的绿色'
  },
  terracotta: {
    name: '赤陶色',
    color: '#C45536',
    category: 'natural',
    description: '大地的陶土红'
  },
  olive: {
    name: '橄榄绿',
    color: '#6B8E23',
    category: 'natural',
    description: '成熟的橄榄色'
  },
  sand: {
    name: '沙漠金',
    color: '#C2B280',
    category: 'natural',
    description: '温暖的沙漠色'
  },
  forest: {
    name: '森林绿',
    color: '#228B22',
    category: 'natural',
    description: '深邃的森林色'
  },
  ocean: {
    name: '海洋蓝',
    color: '#006994',
    category: 'natural',
    description: '深邃的海洋色'
  },
  matcha: {
    name: '抹茶绿',
    color: '#88B04B',
    category: 'natural',
    description: '清新的抹茶色'
  },

  // ============ 现代色系 ============
  dopamine: {
    name: '多巴胺橙',
    color: '#FF6F61',
    category: 'modern',
    description: '活力四射的珊瑚色'
  },
  electric: {
    name: '电光蓝',
    color: '#7DF9FF',
    category: 'modern',
    description: '科技感的电光蓝'
  },
  neon: {
    name: '霓虹粉',
    color: '#FF6EC7',
    category: 'modern',
    description: '炫酷的霓虹粉'
  },
  cyber: {
    name: '赛博紫',
    color: '#9400D3',
    category: 'modern',
    description: '未来感的紫色'
  },
  lime: {
    name: '活力绿',
    color: '#32CD32',
    category: 'modern',
    description: '充满活力的绿色'
  },

  // ============ 复古色系 ============
  dustyRose: {
    name: '复古玫瑰',
    color: '#DCAE96',
    category: 'retro',
    description: '优雅的复古粉'
  },
  midnight: {
    name: '午夜蓝',
    color: '#191970',
    category: 'retro',
    description: '深沉的午夜色'
  },
  caramel: {
    name: '焦糖色',
    color: '#D2691E',
    category: 'retro',
    description: '温暖的焦糖棕'
  },
  wine: {
    name: '酒红色',
    color: '#722F37',
    category: 'retro',
    description: '高贵的酒红'
  },
  hazeBlue: {
    name: '雾霾蓝',
    color: '#6699CC',
    category: 'retro',
    description: '朦胧的雾霾蓝'
  },
  latte: {
    name: '拿铁色',
    color: '#C4A484',
    category: 'retro',
    description: '温暖的咖啡色'
  },
  dirtyOrange: {
    name: '脏橘色',
    color: '#CC7722',
    category: 'retro',
    description: '复古的脏橘调'
  }
}

/**
 * 获取配色方案的颜色值
 */
export function getSchemeColor(schemeKey: string): string {
  const scheme = colorSchemes[schemeKey]
  return scheme?.color || DEFAULT_PRIMARY_COLOR
}

/**
 * 按分类获取配色方案
 */
export function getSchemesByCategory(
  category: ColorSchemeCategory
): Record<string, ColorSchemeDefinition> {
  const result: Record<string, ColorSchemeDefinition> = {}
  for (const [key, scheme] of Object.entries(colorSchemes)) {
    if (scheme.category === category) {
      result[key] = scheme
    }
  }
  return result
}

/**
 * 获取所有分类
 */
export function getAllCategories(): ColorSchemeCategory[] {
  return ['classic', 'morandi', 'macaron', 'natural', 'modern', 'retro']
}

/**
 * 分类显示名称
 */
export const categoryNames: Record<ColorSchemeCategory, string> = {
  classic: '经典配色',
  morandi: '莫兰迪色系',
  macaron: '马卡龙色系',
  natural: '自然色系',
  modern: '现代色系',
  retro: '复古色系'
}

// 主题颜色验证函数
export function isValidColor(color: string): boolean {
  if (typeof window === 'undefined') return true

  const style = new Option().style
  style.color = color
  return style.color !== ''
}

// ============ 颜色工具函数 ============

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null
  const num = Number.parseInt(normalized, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(clamp(Math.round(r), 0, 255))}${toHex(clamp(Math.round(g), 0, 255))}${toHex(
    clamp(Math.round(b), 0, 255)
  )}`
}

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

const hslToRgb = (h: number, s: number, l: number) => {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hh = (h % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hh >= 0 && hh < 1) {
    r = c
    g = x
  } else if (hh >= 1 && hh < 2) {
    r = x
    g = c
  } else if (hh >= 2 && hh < 3) {
    g = c
    b = x
  } else if (hh >= 3 && hh < 4) {
    g = x
    b = c
  } else if (hh >= 4 && hh < 5) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const m = ln - c / 2
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255
  }
}

const normalizeColorToHex = (color: string) => {
  if (typeof document === 'undefined') return DEFAULT_PRIMARY_COLOR
  if (!color || !isValidColor(color)) return DEFAULT_PRIMARY_COLOR
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return DEFAULT_PRIMARY_COLOR
  ctx.fillStyle = '#000'
  ctx.fillStyle = color
  const computed = ctx.fillStyle
  if (computed.startsWith('#')) return computed
  if (computed.startsWith('rgb')) {
    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match) {
      return rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]))
    }
  }
  return DEFAULT_PRIMARY_COLOR
}

// ============ 从图片提取颜色 ============

/**
 * RGB 颜色
 */
interface RGB {
  r: number
  g: number
  b: number
}

/**
 * 提取的颜色结果
 */
export interface ExtractedColor {
  hex: string
  rgb: RGB
  hsl: { h: number; s: number; l: number }
  population: number // 该颜色的像素数量
  name?: string // 自动生成的颜色名称
}

/**
 * 计算颜色距离（欧几里得距离）
 */
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2))
}

/**
 * K-Means 聚类算法提取主要颜色
 */
function kMeansClustering(pixels: RGB[], k: number, maxIterations: number = 20): RGB[] {
  if (pixels.length === 0) return []
  if (pixels.length <= k) return pixels

  // 初始化质心（随机选择）
  const shuffled = [...pixels].sort(() => Math.random() - 0.5)
  const centroids: RGB[] = shuffled.slice(0, k).map(p => ({ ...p }))

  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配像素到最近的质心
    const clusters: RGB[][] = Array.from({ length: k }, () => [])

    for (const pixel of pixels) {
      let minDist = Infinity
      let minIdx = 0
      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(pixel, centroids[i])
        if (dist < minDist) {
          minDist = dist
          minIdx = i
        }
      }
      clusters[minIdx].push(pixel)
    }

    // 更新质心
    let changed = false
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue
      const newCentroid = {
        r: Math.round(clusters[i].reduce((s, p) => s + p.r, 0) / clusters[i].length),
        g: Math.round(clusters[i].reduce((s, p) => s + p.g, 0) / clusters[i].length),
        b: Math.round(clusters[i].reduce((s, p) => s + p.b, 0) / clusters[i].length)
      }
      if (colorDistance(newCentroid, centroids[i]) > 1) {
        changed = true
        centroids[i] = newCentroid
      }
    }

    if (!changed) break
  }

  return centroids
}

/**
 * Median Cut 算法提取主要颜色
 */
function medianCut(pixels: RGB[], depth: number): RGB[] {
  if (depth === 0 || pixels.length === 0) {
    // 返回平均颜色
    if (pixels.length === 0) return []
    const avg = {
      r: Math.round(pixels.reduce((s, p) => s + p.r, 0) / pixels.length),
      g: Math.round(pixels.reduce((s, p) => s + p.g, 0) / pixels.length),
      b: Math.round(pixels.reduce((s, p) => s + p.b, 0) / pixels.length)
    }
    return [avg]
  }

  // 计算每个通道的范围
  let minR = 255,
    maxR = 0,
    minG = 255,
    maxG = 0,
    minB = 255,
    maxB = 0
  for (const p of pixels) {
    minR = Math.min(minR, p.r)
    maxR = Math.max(maxR, p.r)
    minG = Math.min(minG, p.g)
    maxG = Math.max(maxG, p.g)
    minB = Math.min(minB, p.b)
    maxB = Math.max(maxB, p.b)
  }

  const rangeR = maxR - minR
  const rangeG = maxG - minG
  const rangeB = maxB - minB

  // 选择范围最大的通道进行分割
  let channel: 'r' | 'g' | 'b'
  if (rangeR >= rangeG && rangeR >= rangeB) {
    channel = 'r'
  } else if (rangeG >= rangeR && rangeG >= rangeB) {
    channel = 'g'
  } else {
    channel = 'b'
  }

  // 按该通道排序并分割
  const sorted = [...pixels].sort((a, b) => a[channel] - b[channel])
  const mid = Math.floor(sorted.length / 2)

  return [...medianCut(sorted.slice(0, mid), depth - 1), ...medianCut(sorted.slice(mid), depth - 1)]
}

/**
 * 生成颜色名称
 */
function generateColorName(hsl: { h: number; s: number; l: number }): string {
  const { h, s, l } = hsl

  // 亮度描述
  let lightness = ''
  if (l < 20) lightness = '深'
  else if (l < 40) lightness = '暗'
  else if (l > 80) lightness = '浅'
  else if (l > 60) lightness = '亮'

  // 饱和度描述
  let saturation = ''
  if (s < 15) saturation = '灰'
  else if (s < 35) saturation = '淡'

  // 色相描述
  let hue = ''
  if (s < 10) {
    // 接近灰色
    if (l < 20) hue = '黑'
    else if (l > 80) hue = '白'
    else hue = '灰'
  } else if (h < 15 || h >= 345) {
    hue = '红'
  } else if (h < 45) {
    hue = '橙'
  } else if (h < 75) {
    hue = '黄'
  } else if (h < 150) {
    hue = '绿'
  } else if (h < 210) {
    hue = '青'
  } else if (h < 270) {
    hue = '蓝'
  } else if (h < 315) {
    hue = '紫'
  } else {
    hue = '粉'
  }

  return `${lightness}${saturation}${hue}色`
}

/**
 * 从图片提取主要颜色
 * @param imageSource 图片来源（URL、File 或 HTMLImageElement）
 * @param colorCount 提取的颜色数量（默认 6）
 * @param algorithm 使用的算法（'kmeans' | 'mediancut'）
 * @returns 提取的颜色数组
 */
export async function extractColorsFromImage(
  imageSource: string | File | HTMLImageElement,
  colorCount: number = 6,
  algorithm: 'kmeans' | 'mediancut' = 'mediancut'
): Promise<ExtractedColor[]> {
  return new Promise((resolve, reject) => {
    const processImage = async (img: HTMLImageElement) => {
      try {
        // 创建 canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'))
          return
        }

        // 缩小图片以提高性能（最大 100x100）
        const maxSize = 100
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)

        // 绘制图片
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // 获取像素数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // 尝试 WASM 加速路径
        try {
          const { wasmColorService } = await import('@/utils/color/wasmColorService')
          await wasmColorService.initialize()

          if (wasmColorService.isAvailable) {
            const wasmResult =
              algorithm === 'kmeans'
                ? await wasmColorService.quantizeKMeans(imageData, colorCount, 20, 128)
                : await wasmColorService.quantizeMedianCut(imageData, colorCount, 128)

            if (!wasmResult.error && wasmResult.colors.length > 0) {
              const results: ExtractedColor[] = wasmResult.colors.map(c => {
                const hex = rgbToHex(c.r, c.g, c.b)
                const hsl = rgbToHsl(c.r, c.g, c.b)
                return {
                  hex,
                  rgb: { r: c.r, g: c.g, b: c.b },
                  hsl,
                  population: c.population,
                  name: generateColorName(hsl)
                }
              })
              resolve(results)
              return
            }
          }
        } catch {
          // WASM 不可用，回退到 JS 实现
        }

        // JS 回退路径
        const pixels: RGB[] = []

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i]
          const g = imageData.data[i + 1]
          const b = imageData.data[i + 2]
          const a = imageData.data[i + 3]

          // 跳过透明像素
          if (a < 128) continue

          // 跳过接近纯白或纯黑的像素
          if (r > 250 && g > 250 && b > 250) continue
          if (r < 5 && g < 5 && b < 5) continue

          pixels.push({ r, g, b })
        }

        if (pixels.length === 0) {
          resolve([])
          return
        }

        // 使用选定的算法提取颜色
        let dominantColors: RGB[]
        if (algorithm === 'kmeans') {
          dominantColors = kMeansClustering(pixels, colorCount)
        } else {
          // Median Cut 需要 2^n 个颜色
          const depth = Math.ceil(Math.log2(colorCount))
          dominantColors = medianCut(pixels, depth).slice(0, colorCount)
        }

        // 计算每个提取颜色的 population
        const results: ExtractedColor[] = dominantColors.map(color => {
          const hex = rgbToHex(color.r, color.g, color.b)
          const hsl = rgbToHsl(color.r, color.g, color.b)

          // 计算有多少像素接近这个颜色
          let population = 0
          for (const pixel of pixels) {
            if (colorDistance(pixel, color) < 50) {
              population++
            }
          }

          return {
            hex,
            rgb: color,
            hsl,
            population,
            name: generateColorName(hsl)
          }
        })

        // 按 population 降序排序
        results.sort((a, b) => b.population - a.population)

        resolve(results)
      } catch (error) {
        reject(error)
      }
    }

    // 处理不同的输入类型
    if (imageSource instanceof HTMLImageElement) {
      if (imageSource.complete) {
        processImage(imageSource).catch(reject)
      } else {
        imageSource.onload = () => processImage(imageSource).catch(reject)
        imageSource.onerror = () => reject(new Error('图片加载失败'))
      }
    } else if (imageSource instanceof File) {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => processImage(img).catch(reject)
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(imageSource)
    } else {
      // URL 字符串
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => processImage(img).catch(reject)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = imageSource
    }
  })
}

/**
 * 从图片 URL 快速提取主色调
 */
export async function extractPrimaryColorFromImage(
  imageSource: string | File | HTMLImageElement
): Promise<string> {
  const colors = await extractColorsFromImage(imageSource, 1, 'mediancut')
  return colors[0]?.hex || DEFAULT_PRIMARY_COLOR
}

// ============ 色调生成 ============

/**
 * 根据基础 HSL 值和目标色调生成颜色
 * 色调值 0-100 对应 亮度 0%-100%
 */
const buildTone = (base: { h: number; s: number }, tone: number): string => {
  // 使用色调值作为亮度（tone 0 = 黑色，tone 100 = 白色）
  const rgb = hslToRgb(base.h, base.s, clamp(tone, 0, 100))
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

/**
 * 生成完整的色调调色板
 */
const generateTonalPalette = (hue: number, saturation: number): TonalPalette => {
  const palette = {} as TonalPalette
  for (const tone of TONES) {
    palette[tone] = buildTone({ h: hue, s: saturation }, tone)
  }
  return palette
}

/**
 * 从种子颜色生成所有调色板
 */
export const generatePalettes = (seedColor: string): ThemePalettes => {
  const normalized = normalizeColorToHex(seedColor)
  const rgb = hexToRgb(normalized) ?? hexToRgb(DEFAULT_PRIMARY_COLOR) ?? { r: 103, g: 80, b: 164 }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

  // 确保饱和度在合理范围内
  const primarySat = clamp(hsl.s, 35, 90)

  return {
    // 主色调 - 使用种子颜色的色相
    primary: generateTonalPalette(hsl.h, primarySat),

    // 次要色调 - 色相偏移 20°，降低饱和度
    secondary: generateTonalPalette((hsl.h + 20) % 360, clamp(primarySat * 0.5 + 10, 20, 70)),

    // 第三色调 - 色相偏移 60°，降低饱和度
    tertiary: generateTonalPalette((hsl.h + 60) % 360, clamp(primarySat * 0.45 + 12, 18, 70)),

    // 错误色 - 固定红色
    error: generateTonalPalette(0, 75),

    // 中性色 - 保持色相但大幅降低饱和度
    neutral: generateTonalPalette(hsl.h, clamp(primarySat * 0.08 + 2, 2, 15)),

    // 中性变体 - 比中性色略高的饱和度
    'neutral-variant': generateTonalPalette(hsl.h, clamp(primarySat * 0.14 + 4, 4, 25))
  }
}

// ============ 语义颜色映射 ============

/**
 * 从调色板生成 MD3 语义颜色方案
 */
export const generateMd3Scheme = (seedColor: string, mode: 'light' | 'dark'): Md3Scheme => {
  const palettes = generatePalettes(seedColor)
  const p = palettes.primary
  const s = palettes.secondary
  const t = palettes.tertiary
  const e = palettes.error
  const n = palettes.neutral
  const nv = palettes['neutral-variant']

  if (mode === 'dark') {
    return {
      // Primary
      primary: p[80],
      onPrimary: p[20],
      primaryContainer: p[30],
      onPrimaryContainer: p[90],
      // Secondary
      secondary: s[80],
      onSecondary: s[20],
      secondaryContainer: s[30],
      onSecondaryContainer: s[90],
      // Tertiary
      tertiary: t[80],
      onTertiary: t[20],
      tertiaryContainer: t[30],
      onTertiaryContainer: t[90],
      // Error
      error: e[80],
      onError: e[20],
      errorContainer: e[30],
      onErrorContainer: e[90],
      // Surface
      background: n[6],
      onBackground: n[90],
      surface: n[6],
      onSurface: n[90],
      surfaceDim: n[6],
      surfaceBright: n[24],
      surfaceContainerLowest: n[4],
      surfaceContainerLow: n[10],
      surfaceContainer: n[12],
      surfaceContainerHigh: n[17],
      surfaceContainerHighest: n[22],
      surfaceVariant: nv[30],
      onSurfaceVariant: nv[80],
      // Outline
      outline: nv[60],
      outlineVariant: nv[30],
      // Inverse
      inverseSurface: n[90],
      inverseOnSurface: n[20],
      inversePrimary: p[40],
      // Others
      surfaceTint: p[80],
      shadow: '#000000',
      scrim: '#000000'
    }
  }

  // Light mode
  return {
    // Primary
    primary: p[40],
    onPrimary: p[100],
    primaryContainer: p[90],
    onPrimaryContainer: p[10],
    // Secondary
    secondary: s[40],
    onSecondary: s[100],
    secondaryContainer: s[90],
    onSecondaryContainer: s[10],
    // Tertiary
    tertiary: t[40],
    onTertiary: t[100],
    tertiaryContainer: t[90],
    onTertiaryContainer: t[10],
    // Error
    error: e[40],
    onError: e[100],
    errorContainer: e[90],
    onErrorContainer: e[10],
    // Surface
    background: n[98],
    onBackground: n[10],
    surface: n[98],
    onSurface: n[10],
    surfaceDim: n[87],
    surfaceBright: n[98],
    surfaceContainerLowest: n[100],
    surfaceContainerLow: n[96],
    surfaceContainer: n[94],
    surfaceContainerHigh: n[92],
    surfaceContainerHighest: n[90],
    surfaceVariant: nv[90],
    onSurfaceVariant: nv[30],
    // Outline
    outline: nv[50],
    outlineVariant: nv[80],
    // Inverse
    inverseSurface: n[20],
    inverseOnSurface: n[95],
    inversePrimary: p[80],
    // Others
    surfaceTint: p[40],
    shadow: '#000000',
    scrim: '#000000'
  }
}

// ============ CSS 变量应用 ============

const toKebab = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * 将所有调色板应用为 CSS 变量
 * 生成格式：--palette-{name}-{tone}
 * 例如：--palette-primary-40, --palette-neutral-90
 */
export const applyPalettesToRoot = (
  seedColor: string,
  root: HTMLElement = document.documentElement
): ThemePalettes => {
  const palettes = generatePalettes(seedColor)

  for (const [paletteName, palette] of Object.entries(palettes)) {
    for (const [tone, color] of Object.entries(palette)) {
      root.style.setProperty(`--palette-${paletteName}-${tone}`, color)
    }
  }

  return palettes
}

/**
 * 将 MD3 语义颜色应用为 CSS 变量
 */
export const applyMd3SchemeToRoot = (
  primaryColor: string,
  mode: 'light' | 'dark',
  root: HTMLElement = document.documentElement
): Md3Scheme => {
  // 首先应用调色板
  applyPalettesToRoot(primaryColor, root)

  // 生成语义颜色
  const scheme = generateMd3Scheme(primaryColor, mode)

  // 应用 MD3 语义变量
  for (const [key, value] of Object.entries(scheme)) {
    root.style.setProperty(`--md3-${toKebab(key)}`, value)
  }

  // 应用主题变量（保持向后兼容）
  root.style.setProperty('--theme-primary', scheme.primary)
  root.style.setProperty('--theme-on-primary', scheme.onPrimary)
  root.style.setProperty('--theme-primary-container', scheme.primaryContainer)
  root.style.setProperty('--theme-on-primary-container', scheme.onPrimaryContainer)
  root.style.setProperty('--theme-secondary', scheme.secondary)
  root.style.setProperty('--theme-on-secondary', scheme.onSecondary)
  root.style.setProperty('--theme-secondary-container', scheme.secondaryContainer)
  root.style.setProperty('--theme-on-secondary-container', scheme.onSecondaryContainer)
  root.style.setProperty('--theme-tertiary', scheme.tertiary)
  root.style.setProperty('--theme-on-tertiary', scheme.onTertiary)
  root.style.setProperty('--theme-tertiary-container', scheme.tertiaryContainer)
  root.style.setProperty('--theme-on-tertiary-container', scheme.onTertiaryContainer)
  root.style.setProperty('--theme-surface', scheme.surface)
  root.style.setProperty('--theme-on-surface', scheme.onSurface)
  root.style.setProperty('--theme-surface-dim', scheme.surfaceDim)
  root.style.setProperty('--theme-surface-bright', scheme.surfaceBright)
  root.style.setProperty('--theme-surface-container-lowest', scheme.surfaceContainerLowest)
  root.style.setProperty('--theme-surface-container-low', scheme.surfaceContainerLow)
  root.style.setProperty('--theme-surface-container', scheme.surfaceContainer)
  root.style.setProperty('--theme-surface-container-high', scheme.surfaceContainerHigh)
  root.style.setProperty('--theme-surface-container-highest', scheme.surfaceContainerHighest)
  root.style.setProperty('--theme-surface-variant', scheme.surfaceVariant)
  root.style.setProperty('--theme-on-surface-variant', scheme.onSurfaceVariant)
  root.style.setProperty('--theme-outline', scheme.outline)
  root.style.setProperty('--theme-outline-variant', scheme.outlineVariant)
  root.style.setProperty('--theme-background', scheme.background)
  root.style.setProperty('--theme-on-background', scheme.onBackground)
  root.style.setProperty('--theme-error', scheme.error)
  root.style.setProperty('--theme-on-error', scheme.onError)
  root.style.setProperty('--theme-error-container', scheme.errorContainer)
  root.style.setProperty('--theme-on-error-container', scheme.onErrorContainer)
  root.style.setProperty('--theme-inverse-surface', scheme.inverseSurface)
  root.style.setProperty('--theme-inverse-on-surface', scheme.inverseOnSurface)
  root.style.setProperty('--theme-inverse-primary', scheme.inversePrimary)
  root.style.setProperty('--theme-shadow', scheme.shadow)
  root.style.setProperty('--theme-scrim', scheme.scrim)

  // 兼容性别名
  root.style.setProperty('--theme-accent', scheme.primary)
  root.style.setProperty('--theme-accent-strong', scheme.primaryContainer)
  root.style.setProperty('--theme-danger', scheme.error)
  root.style.setProperty('--theme-on-danger', scheme.onError)

  return scheme
}

/**
 * 获取调色板中指定色调的 CSS 变量引用
 * 用于在 CSS 中引用：var(--palette-primary-40)
 */
export const paletteVar = (palette: PaletteName, tone: Tone): string => {
  return `var(--palette-${palette}-${tone})`
}

/**
 * 获取 MD3 语义颜色的 CSS 变量引用
 * 用于在 CSS 中引用：var(--md3-primary)
 */
export const md3Var = (name: keyof Md3Scheme): string => {
  return `var(--md3-${toKebab(name)})`
}

/**
 * 获取主题颜色的 CSS 变量引用
 * 用于在 CSS 中引用：var(--theme-primary)
 */
export const themeVar = (name: string): string => {
  return `var(--theme-${toKebab(name)})`
}

// 兼容性别名
export const applyMd3ThemeToRoot = applyMd3SchemeToRoot
