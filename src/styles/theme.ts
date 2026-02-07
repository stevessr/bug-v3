import { applyMd3ThemeToRoot, DEFAULT_PRIMARY_COLOR, colorSchemes, isValidColor } from './md3Theme'

import { getSettings, storageGet } from '@/utils/simpleStorage'

async function applyTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const theme = (await storageGet<string>('theme')) || 'system'
  const root = document.documentElement

  async function apply(theme: string) {
    let finalTheme = theme
    if (theme === 'system') {
      finalTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    // 设置 data-theme 属性供 Tailwind CSS 使用
    root.setAttribute('data-theme', finalTheme)

    // 设置 class 属性供 Tailwind CSS dark: 前缀使用
    if (finalTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // 触发自定义事件，通知主题变更（供应用内同步）
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: {
          mode: finalTheme,
          theme: theme
        }
      })
    )

    const settings = await getSettings()
    let primaryColor = DEFAULT_PRIMARY_COLOR

    // 优先使用预设方案
    const schemeKey = settings?.md3ColorScheme
    if (schemeKey && colorSchemes[schemeKey]) {
      primaryColor = colorSchemes[schemeKey].color
    } else if (settings?.md3SeedColor && isValidColor(settings.md3SeedColor)) {
      // 如果没有预设方案或预设方案无效，尝试使用自定义种子色
      primaryColor = settings.md3SeedColor
    }

    applyMd3ThemeToRoot(primaryColor, finalTheme as 'light' | 'dark')
  }

  void apply(theme)

  window.addEventListener('theme-colors-changed', event => {
    const detail = (event as CustomEvent).detail as { primaryColor?: string } | undefined
    const mode =
      (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
    applyMd3ThemeToRoot(detail?.primaryColor || DEFAULT_PRIMARY_COLOR, mode)
  })

  window.addEventListener('theme-changed', async event => {
    const detail = (event as CustomEvent).detail as { mode?: 'light' | 'dark' } | undefined
    const settings = await getSettings()

    let primaryColor = DEFAULT_PRIMARY_COLOR
    const schemeKey = settings?.md3ColorScheme
    if (schemeKey && colorSchemes[schemeKey]) {
      primaryColor = colorSchemes[schemeKey].color
    } else if (settings?.md3SeedColor && isValidColor(settings.md3SeedColor)) {
      primaryColor = settings.md3SeedColor
    }

    const mode =
      detail?.mode || (document.documentElement.getAttribute('data-theme') as 'light' | 'dark')
    applyMd3ThemeToRoot(primaryColor, mode || 'light')
  })

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const currentTheme = (await storageGet<string>('theme')) || 'system'
    if (currentTheme === 'system') {
      void apply('system')
    }
  })
}

applyTheme()

// 获取当前主题模式（基于存储的主题设置 + 系统偏好）
export async function getCurrentThemeMode(): Promise<'light' | 'dark'> {
  if (typeof window === 'undefined') return 'light'

  const themeValue = (await storageGet<string>('theme')) || 'system'

  if (themeValue === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return themeValue as 'light' | 'dark'
}
