import { applyMd3ThemeToRoot, DEFAULT_PRIMARY_COLOR, colorSchemes } from '@/styles/md3Theme'
import { storageGet, storageSet } from '@/utils/simpleStorage'
import type { AppSettings } from '@/types/type'

/**
 * 主题管理 Composable
 * 负责管理应用主题（亮色/暗色/系统）和自定义颜色
 */
export function useThemeManager(options: {
  updateSettings: (partial: Partial<AppSettings>) => void
}) {
  const { updateSettings } = options

  /**
   * 应用主题到 DOM
   */
  const applyTheme = (theme: 'system' | 'light' | 'dark') => {
    // 应用主题类名
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // system theme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    // 设置 data-theme 属性
    const finalTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme
    document.documentElement.setAttribute('data-theme', finalTheme)

    // 触发主题变化事件，通知 MD3 主题更新
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: {
          mode: finalTheme,
          theme: theme
        }
      })
    )
  }

  /**
   * 更新主题设置
   */
  const updateTheme = async (theme: 'system' | 'light' | 'dark') => {
    updateSettings({ theme })
    await storageSet('theme', theme)
    applyTheme(theme)
  }


  /**
   * 更新自定义配色方案
   */
  const updateMd3ColorScheme = (scheme: AppSettings['md3ColorScheme']) => {
    // 如果清空 scheme（通常是因为切换到了自定义颜色），只更新设置，不应用默认颜色
    // 避免覆盖 updateMd3SeedColor 设置的颜色
    if (!scheme) {
      updateSettings({ md3ColorScheme: scheme })
      return
    }

    let seed = DEFAULT_PRIMARY_COLOR
    if (scheme && colorSchemes[scheme]) {
      seed = colorSchemes[scheme].color
      // 选择预设时，清空自定义种子色
      updateSettings({ md3ColorScheme: scheme, md3SeedColor: undefined })
    } else {
      // 理论上不应该走到这里，除非 scheme 是无效字符串但不是空
      updateSettings({ md3ColorScheme: scheme })
    }

    const currentMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    applyMd3ThemeToRoot(seed, currentMode)
  }

  /**
   * 更新自定义种子色
   */
  const updateMd3SeedColor = (color: string | undefined) => {
    if (!color) {
      updateSettings({ md3SeedColor: undefined })
      return
    }

    updateSettings({ md3SeedColor: color, md3ColorScheme: '' })

    const currentMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    applyMd3ThemeToRoot(color, currentMode)
  }

  /**
   * 初始化主题（在应用启动时调用）
   */
  const initTheme = (currentTheme: 'system' | 'light' | 'dark') => {
    applyTheme(currentTheme)

    // 监听系统主题变化（仅在 system 模式下）
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = async () => {
      const savedTheme = (await storageGet<string>('theme')) || 'system'
      if (savedTheme === 'system') {
        applyTheme('system')
      }
    }

    // 使用 addEventListener 而不是 deprecated addListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange)
    }

    // 返回清理函数
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange)
      }
    }
  }

  return {
    updateTheme,
    updateMd3ColorScheme,
    updateMd3SeedColor,
    initTheme,
    applyTheme
  }
}
