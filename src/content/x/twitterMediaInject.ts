export function tryInjectTwitterMedia(
  url: string,
  targetContainer: Element,
  createOverlayFn: (data: { name: string; url: string }, target: Element) => HTMLElement | void,
  console: { log: (...args: any[]) => void }
): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    // 扩展Twitter媒体检测范围，包括更多pbs.twimg.com的路径
    const isTwitterMedia =
      host === 'pbs.twimg.com' &&
      (parsed.pathname.startsWith('/media/') || parsed.pathname.includes('/media/'))

    if (!isTwitterMedia) return false

    // 检查是否已经有按钮，避免重复注入
    if (
      targetContainer.querySelector('.x-emoji-add-btn-carousel') ||
      targetContainer.querySelector('.x-emoji-add-btn')
    ) {
      console.log('[TwitterMedia] button already exists, skipping injection')
      return true
    }

    // Find the actual <img> element if present, otherwise use the provided container
    let imgEl: HTMLImageElement | null = null
    if (targetContainer instanceof HTMLImageElement) imgEl = targetContainer
    else imgEl = targetContainer.querySelector('img') as HTMLImageElement | null

    const target = (imgEl as Element) || targetContainer

    // Build a simple name from filename or fallback
    const name = parsed.pathname.split('/').pop()?.split('?')[0] || '表情'

    // Use the provided overlay creation function to inject a floating button
    try {
      createOverlayFn({ name, url }, target)
      console.log('[TwitterMedia] injected floating overlay for media:', url)
      return true
    } catch (e) {
      // overlay creation failed
      console.log('[TwitterMedia] overlay injection failed', e)
      return false
    }
  } catch (e) {
    console.log('[TwitterMedia] error processing URL:', url, e)
    return false
  }
}
