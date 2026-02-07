/**
 * Ant Design Vue 自定义主题覆盖
 * 使用 MD3 CSS 变量替代 Ant Design 内置主题系统
 */

import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme } from 'ant-design-vue'

import { storageGet } from '@/utils/simpleStorage'

// 预设配色方案（用于 ThemeColorPicker）
export const colorSchemes = {
  default: '#1890ff',
  blue: '#1890ff',
  green: '#52c41a',
  purple: '#722ed1',
  orange: '#fa8c16',
  red: '#f5222d'
}

/**
 * 生成使用 CSS 变量的 Ant Design 主题配置
 * 所有颜色都引用 MD3 CSS 变量，实现动态主题
 */
export function generateAntdTheme(mode: 'light' | 'dark'): ThemeConfig {
  // 使用 CSS 变量作为颜色值
  // 注意：Ant Design 的 token 需要具体颜色值，不支持 CSS 变量
  // 所以我们使用 cssVar 配置让 Ant Design 生成 CSS 变量
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    cssVar: true,
    hashed: false,
    token: {
      // 使用较为中性的基础配置，实际颜色通过 CSS 覆盖
      colorPrimary: '#1890ff',
      borderRadius: 6
    }
  }
}

// 获取当前主题模式
export async function getCurrentThemeMode(): Promise<'light' | 'dark'> {
  if (typeof window === 'undefined') return 'light'

  const themeValue = (await storageGet<string>('theme')) || 'system'

  if (themeValue === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return themeValue as 'light' | 'dark'
}

// 主题颜色验证函数
export function isValidColor(color: string): boolean {
  if (typeof window === 'undefined') return true

  const style = new Option().style
  style.color = color
  return style.color !== ''
}
