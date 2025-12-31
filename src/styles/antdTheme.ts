import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme } from 'ant-design-vue'

// 预设配色方案
export const colorSchemes = {
  default: '#1890ff', // Ant Design 默认蓝色
  blue: '#1890ff',
  green: '#52c41a',
  purple: '#722ed1',
  orange: '#fa8c16',
  red: '#f5222d'
}

// 根据主题模式和颜色生成 Ant Design Vue 主题配置
export function generateAntdTheme(
  mode: 'light' | 'dark',
  primaryColor: string = colorSchemes.default
): ThemeConfig {
  if (mode === 'dark') {
    return {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: primaryColor,
        colorBgContainer: '#141414',
        colorBgElevated: '#1f1f1f',
        colorBgLayout: '#000000',
        colorBorder: '#303030',
        colorBorderSecondary: '#303030',
        colorFill: '#1f1f1f',
        colorFillAlter: '#262626',
        colorFillContent: '#1f1f1f',
        colorFillSecondary: '#262626',
        colorBgMask: 'rgba(0, 0, 0, 0.45)',
        colorTextBase: '#ffffff',
        colorText: 'rgba(255, 255, 255, 0.85)',
        colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
        colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
        colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',
        colorBgTextHover: 'rgba(255, 255, 255, 0.03)',
        colorBgTextActive: 'rgba(255, 255, 255, 0.05)'
      }
    }
  }

  return {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: primaryColor,
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBgLayout: '#f5f5f5',
      colorBorder: '#d9d9d9',
      colorBorderSecondary: '#f0f0f0',
      colorFill: '#f5f5f5',
      colorFillAlter: '#fafafa',
      colorFillContent: '#f5f5f5',
      colorFillSecondary: '#fafafa',
      colorBgMask: 'rgba(0, 0, 0, 0.45)',
      colorTextBase: '#000000',
      colorText: 'rgba(0, 0, 0, 0.88)',
      colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
      colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
      colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',
      colorBgTextHover: 'rgba(0, 0, 0, 0.06)',
      colorBgTextActive: 'rgba(0, 0, 0, 0.15)'
    }
  }
}

import { storageGet } from '@/utils/simpleStorage'

// 获取当前主题模式
export async function getCurrentThemeMode(): Promise<'light' | 'dark'> {
  if (typeof window === 'undefined') return 'light'

  const theme = (await storageGet<string>('theme')) || 'system'

  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return theme as 'light' | 'dark'
}

// 主题颜色验证函数
export function isValidColor(color: string): boolean {
  if (typeof window === 'undefined') return true

  const style = new Option().style
  style.color = color
  return style.color !== ''
}
