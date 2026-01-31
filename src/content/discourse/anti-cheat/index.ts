/**
 * Anti-Cheat: Discourse 水印替换功能
 * 修改 Discourse 站点的隐形水印文字
 */

let initialized = false

export function initAntiCheat(customText: string = 'Hello World') {
  if (initialized) return
  initialized = true

  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL

  HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: number): string {
    const pixelRatio = window.devicePixelRatio || 1
    // 130 是 Discourse 源码中的 density 设置
    if (this.width === this.height && Math.abs(this.width - 130 * pixelRatio) < 5) {
      const ctx = this.getContext('2d')
      if (ctx) {
        const originalColor = ctx.fillStyle
        const originalFont = ctx.font
        const w = this.width
        const h = this.height

        // 清空并重置
        this.width = w

        // 重绘
        ctx.fillStyle = originalColor as string
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = originalFont

        ctx.translate(w / 2, h / 2)
        ctx.rotate((-25 * Math.PI) / 180)
        ctx.fillText(customText, 0, 0)
      }
      return originalToDataURL.call(this, type, quality)
    }
    return originalToDataURL.apply(this, arguments as unknown as [string?, number?])
  }

  console.log('[AntiCheat] Canvas watermark replacement enabled')
}
