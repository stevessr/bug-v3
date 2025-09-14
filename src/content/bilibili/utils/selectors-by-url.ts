import OPUS_SELECTORS from './opus-selectors'

/**
 * Return selector list based on current URL (prioritize opus selectors on opus/t pages)
 */
export function getSelectorsForCurrentUrl(): string[] {
  try {
    const host = window.location.hostname.toLowerCase()
    const path = window.location.pathname
    const isOpusPath = /\/opus\//.test(path)
    const isTDomain = host === 't.bilibili.com' || host.endsWith('.t.bilibili.com')
    if (isOpusPath || isTDomain) {
      return [
        ...OPUS_SELECTORS,
        '.bili-album__preview__picture__img',
        '.bili-album__preview__picture',
        '.bili-album__watch__track__item',
        '.bili-album__watch__content img'
      ]
    }
  } catch (e) {
    void e
  }

  // default selectors
  return [
    '.bili-album__preview__picture__img',
    '.bili-album__preview__picture',
    '.bili-album__watch__track__item',
    '.bili-album__watch__content img'
  ]
}

export default getSelectorsForCurrentUrl
