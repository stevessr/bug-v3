import { AddEmojiButtonData } from '../utils'

export function tryInjectTwitterMedia(
  url: string,
  targetContainer: Element,
  createOverlayFn: (data: AddEmojiButtonData, target: Element) => HTMLElement | void
): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const isTwitterMedia =
      host === 'pbs.twimg.com' &&
      (parsed.pathname.startsWith('/media/') || parsed.pathname.includes('/media/'))
    const pathname = parsed.pathname.toLowerCase()
    const formatParam = (parsed.searchParams.get('format') || '').toLowerCase()
    if (pathname.endsWith('.svg') || formatParam === 'svg') return false
    if (!isTwitterMedia) return false

    if (
      targetContainer.querySelector('.x-emoji-add-btn-carousel') ||
      targetContainer.querySelector('.x-emoji-add-btn')
    ) {
      console.log('[TwitterMedia] button already exists, skipping injection')
      targetContainer.classList.add('injected')
      return true
    }

    if (targetContainer.classList.contains('injected')) {
      const parent = targetContainer.parentElement
      if (parent) parent.classList.add('injected')
      return true
    }

    let imgEl: HTMLImageElement | null = null
    if (targetContainer instanceof HTMLImageElement) imgEl = targetContainer
    else imgEl = targetContainer.querySelector('img') as HTMLImageElement | null

    const target = (imgEl as Element) || targetContainer
    if (target.classList.contains('injected')) {
      targetContainer.classList.add('injected')
      return true
    }
    const name = parsed.pathname.split('/').pop()?.split('?')[0] || '表情'

    try {
      createOverlayFn({ name, url }, target)
      targetContainer.classList.add('injected')
      target.classList.add('injected')
      console.log('[TwitterMedia] injected floating overlay for media:', url)
      return true
    } catch (error) {
      console.log('[TwitterMedia] overlay injection failed', error)
      return false
    }
  } catch (error) {
    console.log('[TwitterMedia] error processing URL:', url, error)
    return false
  }
}
