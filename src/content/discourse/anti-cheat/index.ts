/**
 * Anti-Cheat: Discourse 水印替换功能
 * 修改 Discourse 站点的隐形水印文字
 *
 * 注意：此脚本需要注入到页面主世界（main world）才能生效
 * 因为 content script 运行在隔离世界，无法修改页面的原型链
 */

let initialized = false

/**
 * 生成注入到页面的脚本代码
 */
function generateInjectionScript(customText: string): string {
  return `
(function() {
  'use strict';

  if (window.__antiCheatInitialized) return;
  window.__antiCheatInitialized = true;

  const CUSTOM_TEXT = ${JSON.stringify(customText)};
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    const pixelRatio = window.devicePixelRatio || 1;
    // 130 是 Discourse 源码中的 density 设置
    if (this.width === this.height && Math.abs(this.width - (130 * pixelRatio)) < 5) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const originalColor = ctx.fillStyle;
        const originalFont = ctx.font;
        const w = this.width;
        const h = this.height;

        // 清空并重置
        this.width = w;

        // 重绘
        ctx.fillStyle = originalColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = originalFont;

        ctx.translate(w / 2, h / 2);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.fillText(CUSTOM_TEXT, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    }
    return originalToDataURL.apply(this, arguments);
  };

  console.log('[AntiCheat] Canvas watermark replacement active:', CUSTOM_TEXT);
})();
`
}

/**
 * 将脚本注入到页面主世界
 */
function injectScript(code: string): void {
  const script = document.createElement('script')
  script.textContent = code
  // 插入到 head 或 documentElement，确保尽早执行
  const target = document.head || document.documentElement
  target.insertBefore(script, target.firstChild)
  // 执行后立即移除，保持 DOM 干净
  script.remove()
}

export function initAntiCheat(customText: string = 'Hello World') {
  if (initialized) return
  initialized = true

  try {
    const scriptCode = generateInjectionScript(customText)
    injectScript(scriptCode)
    console.log('[AntiCheat] Script injected to main world')
  } catch (e) {
    console.error('[AntiCheat] Failed to inject script:', e)
  }
}
