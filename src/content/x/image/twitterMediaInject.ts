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
    if (!isTwitterMedia) return false

    if (
      targetContainer.querySelector('.x-emoji-add-btn-carousel') ||
      targetContainer.querySelector('.x-emoji-add-btn')
    ) {
      console.log('[TwitterMedia] button already exists, skipping injection')
      return true
    }

    let imgEl: HTMLImageElement | null = null
    if (targetContainer instanceof HTMLImageElement) imgEl = targetContainer
    else imgEl = targetContainer.querySelector('img') as HTMLImageElement | null

    const target = (imgEl as Element) || targetContainer
    const name = parsed.pathname.split('/').pop()?.split('?')[0] || '表情'

    try {
      createOverlayFn({ name, url }, target)
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
