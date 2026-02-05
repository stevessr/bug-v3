import { isValidColor } from './antdTheme'

export type Md3Scheme = Record<string, string>

const DEFAULT_PRIMARY_COLOR = '#1890ff'

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

const buildTone = (base: { h: number; s: number; l: number }, tone: number) => {
  const rgb = hslToRgb(base.h, base.s, clamp(tone, 0, 100))
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

const buildPalette = (base: { h: number; s: number; l: number }) => {
  return (tone: number) => buildTone(base, tone)
}

export const generateMd3Scheme = (seedColor: string, mode: 'light' | 'dark'): Md3Scheme => {
  const normalized = normalizeColorToHex(seedColor)
  const rgb = hexToRgb(normalized) || hexToRgb(DEFAULT_PRIMARY_COLOR)!
  const seedHsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const primaryBase = { h: seedHsl.h, s: clamp(seedHsl.s, 35, 90), l: seedHsl.l }
  const secondaryBase = {
    h: (seedHsl.h + 20) % 360,
    s: clamp(seedHsl.s * 0.5 + 10, 20, 70),
    l: seedHsl.l
  }
  const tertiaryBase = {
    h: (seedHsl.h + 60) % 360,
    s: clamp(seedHsl.s * 0.45 + 12, 18, 70),
    l: seedHsl.l
  }
  const neutralBase = {
    h: seedHsl.h,
    s: clamp(seedHsl.s * 0.08 + 2, 2, 15),
    l: seedHsl.l
  }
  const neutralVariantBase = {
    h: seedHsl.h,
    s: clamp(seedHsl.s * 0.14 + 4, 4, 25),
    l: seedHsl.l
  }

  const primary = buildPalette(primaryBase)
  const secondary = buildPalette(secondaryBase)
  const tertiary = buildPalette(tertiaryBase)
  const neutral = buildPalette(neutralBase)
  const neutralVariant = buildPalette(neutralVariantBase)

  if (mode === 'dark') {
    return {
      primary: primary(80),
      onPrimary: primary(20),
      primaryContainer: primary(30),
      onPrimaryContainer: primary(90),
      secondary: secondary(80),
      onSecondary: secondary(20),
      secondaryContainer: secondary(30),
      onSecondaryContainer: secondary(90),
      tertiary: tertiary(80),
      onTertiary: tertiary(20),
      tertiaryContainer: tertiary(30),
      onTertiaryContainer: tertiary(90),
      error: '#f2b8b5',
      onError: '#601410',
      errorContainer: '#8c1d18',
      onErrorContainer: '#f9dedc',
      background: neutral(6),
      onBackground: neutral(90),
      surface: neutral(6),
      onSurface: neutral(90),
      surfaceVariant: neutralVariant(30),
      onSurfaceVariant: neutralVariant(80),
      outline: neutralVariant(60),
      outlineVariant: neutralVariant(30),
      inverseSurface: neutral(90),
      inverseOnSurface: neutral(20),
      inversePrimary: primary(40),
      surfaceTint: primary(80),
      shadow: '#000000'
    }
  }

  return {
    primary: primary(40),
    onPrimary: primary(100),
    primaryContainer: primary(90),
    onPrimaryContainer: primary(10),
    secondary: secondary(40),
    onSecondary: secondary(100),
    secondaryContainer: secondary(90),
    onSecondaryContainer: secondary(10),
    tertiary: tertiary(40),
    onTertiary: tertiary(100),
    tertiaryContainer: tertiary(90),
    onTertiaryContainer: tertiary(10),
    error: '#b3261e',
    onError: '#ffffff',
    errorContainer: '#f9dedc',
    onErrorContainer: '#410e0b',
    background: neutral(98),
    onBackground: neutral(10),
    surface: neutral(98),
    onSurface: neutral(10),
    surfaceVariant: neutralVariant(90),
    onSurfaceVariant: neutralVariant(30),
    outline: neutralVariant(50),
    outlineVariant: neutralVariant(80),
    inverseSurface: neutral(20),
    inverseOnSurface: neutral(95),
    inversePrimary: primary(80),
    surfaceTint: primary(40),
    shadow: '#000000'
  }
}

const toKebab = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

export const applyMd3ThemeToRoot = (
  primaryColor: string,
  mode: 'light' | 'dark',
  root: HTMLElement = document.documentElement
) => {
  const scheme = generateMd3Scheme(primaryColor, mode)
  for (const [key, value] of Object.entries(scheme)) {
    root.style.setProperty(`--md3-${toKebab(key)}`, value)
  }
  root.style.setProperty('--theme-primary', scheme.primary)
  root.style.setProperty('--theme-on-primary', scheme.onPrimary)
  root.style.setProperty('--theme-primary-container', scheme.primaryContainer)
  root.style.setProperty('--theme-on-primary-container', scheme.onPrimaryContainer)
  root.style.setProperty('--theme-secondary', scheme.secondary)
  root.style.setProperty('--theme-on-secondary', scheme.onSecondary)
  root.style.setProperty('--theme-surface', scheme.surface)
  root.style.setProperty('--theme-on-surface', scheme.onSurface)
  root.style.setProperty('--theme-surface-variant', scheme.surfaceVariant)
  root.style.setProperty('--theme-on-surface-variant', scheme.onSurfaceVariant)
  root.style.setProperty('--theme-outline', scheme.outline)
  root.style.setProperty('--theme-outline-variant', scheme.outlineVariant)
  root.style.setProperty('--theme-background', scheme.background)
  root.style.setProperty('--theme-on-background', scheme.onBackground)
  root.style.setProperty('--theme-accent', scheme.primary)
  root.style.setProperty('--theme-accent-strong', scheme.primaryContainer)
  root.style.setProperty('--theme-danger', scheme.error)
  root.style.setProperty('--theme-on-danger', scheme.onError)
  return scheme
}

export { DEFAULT_PRIMARY_COLOR }
