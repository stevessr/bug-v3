
console.log('[Emoji Extension] content-x loaded')
try {
  const init = (window as any).__emoji_x_init
  if (typeof init === 'function') init()
} catch (e) {
  console.error('[content-x] initX failed', e)
}
