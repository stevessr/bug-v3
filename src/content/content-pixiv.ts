
console.log('[Emoji Extension] content-pixiv loaded')
try {
  const init = (window as any).__emoji_pixiv_init
  if (typeof init === 'function') init()
  else console.warn('[content-pixiv] init function not available on window')
} catch (e) {
  console.error('[content-pixiv] initPixiv failed', e)
}
