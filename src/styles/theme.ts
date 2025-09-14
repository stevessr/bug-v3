import { getCurrentThemeMode } from './antdTheme'

function applyTheme() {
  const theme = localStorage.getItem('theme') || 'system'
  const root = document.documentElement

  function apply(theme: string) {
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

    // 触发自定义事件，通知 Ant Design Vue 主题变更
    window.dispatchEvent(new CustomEvent('theme-changed', { 
      detail: { 
        mode: finalTheme, 
        theme: theme 
      } 
    }))
  }

  apply(theme)

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    const currentTheme = localStorage.getItem('theme') || 'system'
    if (currentTheme === 'system') {
      apply('system')
    }
  })
}

applyTheme()

// 导出工具函数
export { getCurrentThemeMode }
