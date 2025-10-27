import { createE, DOA, DEBI } from './createEl'
// Lightweight toast notification utility for content scripts
export function notify(
  message: string,
  type: 'info' | 'success' | 'error' | 'transparent' | 'rainbow' = 'info',
  timeout = 4000
) {
  try {
    let container = DEBI('emoji-ext-toast-container') as HTMLElement | null
    if (!container) {
      container = createE('div', {
        id: 'emoji-ext-toast-container',
        style: `
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          gap: 8px;
        `
      }) as HTMLElement
      DOA(container)
    }

    const el = createE('div', {
      text: message,
      style: `
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        color: #ffffff;
        font-size: 13px;
        max-width: 320px;
        word-break: break-word;
        transform: translateY(20px);
      `
    }) as HTMLElement

    if (type === 'success') el.style.background = '#16a34a'
    else if (type === 'error') el.style.background = '#dc2626'
    else if (type === 'transparent') el.style.background = 'transparent'
    else if (type === 'rainbow') {
      // --- 关键修改：添加彩虹动画样式 ---
      // 1. 设置超宽渐变背景
      el.style.background = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet, red)'
      // 2. 设置背景尺寸，使其比容器宽很多
      el.style.backgroundSize = '400% 100%'

      // 3. 定义并应用 `@keyframes` 动画
      // 注意：在运行时动态插入 `@keyframes` 到 `<style>` 标签或文档中可能更干净，
      // 但对于轻量级通知，直接使用 CSSOM 设置 `animation` 属性并依赖
      // 外部定义的 keyframes 是最简洁的方式。
      // **然而，在您当前的环境中，由于 `el.style.animation` 无法定义 `@keyframes`，
      // 最佳实践是将其定义在您的全局 CSS 或一个动态 `<style>` 块中。**
      
      // 假设您已在全局或某个地方定义了 `color-shift` keyframes (这是推荐的做法):
      // @keyframes color-shift { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
      el.style.animation = 'color-shift 15s linear infinite'

      // 如果您无法在外部定义 keyframes，且需要一个纯 JS/TS 解决方案，则需要动态创建 <style> 标签：
      if (!DEBI('color-shift-keyframes')) {
          const styleEl = createE('style', {
              id: 'color-shift-keyframes',
              text: `
                @keyframes color-shift {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 100% 50%; }
                }
              `
          }) as HTMLStyleElement
          DOA(styleEl) // 插入到 document body
      }
      
      // 确保动画应用，即在 keyframes 被插入后，`el.style.animation` 才能生效
      el.style.animation = 'color-shift 1s linear infinite'
      
    }
    else el.style.background = '#0369a1' // info

    container.appendChild(el)

    // ... (rest of the code is unchanged)
    
    const id = setTimeout(() => {
      el.remove()
      clearTimeout(id)
    }, timeout)

    return () => {
      el.remove()
      clearTimeout(id)
    }
  } catch {
    // Fallback to alert if DOM manipulation fails
    try {
      // eslint-disable-next-line no-alert
      alert(message)
    } catch {
      // ignore
    }
    return () => {}
  }
}