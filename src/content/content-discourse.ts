
console.log('[Emoji Extension] content-discourse loaded')
try {
  const init = (window as any).__emoji_discourse_init
  if (typeof init === 'function') init()
} catch (e) {
  console.error('[content-discourse] initDiscourse failed', e)
}
