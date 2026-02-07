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
 * 每个色调包含完整的色阶: 0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100
 */

import { isValidColor } from './antdTheme'

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

export const DEFAULT_PRIMARY_COLOR = '#1890ff'

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
  const rgb = hexToRgb(normalized) ?? hexToRgb(DEFAULT_PRIMARY_COLOR) ?? { r: 24, g: 144, b: 255 }
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
 * 生成格式: --palette-{name}-{tone}
 * 例如: --palette-primary-40, --palette-neutral-90
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
 * 用于在 CSS 中引用: var(--palette-primary-40)
 */
export const paletteVar = (palette: PaletteName, tone: Tone): string => {
  return `var(--palette-${palette}-${tone})`
}

/**
 * 获取 MD3 语义颜色的 CSS 变量引用
 * 用于在 CSS 中引用: var(--md3-primary)
 */
export const md3Var = (name: keyof Md3Scheme): string => {
  return `var(--md3-${toKebab(name)})`
}

/**
 * 获取主题颜色的 CSS 变量引用
 * 用于在 CSS 中引用: var(--theme-primary)
 */
export const themeVar = (name: string): string => {
  return `var(--theme-${toKebab(name)})`
}

export { DEFAULT_PRIMARY_COLOR }
