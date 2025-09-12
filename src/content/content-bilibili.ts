
console.log('[Emoji Extension] content-bilibili loaded')
try {
  const init = (window as any).__emoji_bilibili_init
  if (typeof init === 'function') {
    init()
  } else {
    // Fallback: try to require via runtime sendMessage injection path or no-op
    console.warn('[content-bilibili] init function not available on window')
  }
} catch (e) {
  console.error('[content-bilibili] initBilibili failed', e)
}
