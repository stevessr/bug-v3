import { installDefaultNachonekoPicker } from '../helper/inject/feature'

const stops: Array<() => void> = []

function startAll() {
  try {
    const picker = installDefaultNachonekoPicker()
    if (picker && typeof picker.stop === 'function') stops.push(() => picker.stop())
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('failed to start inject features', err)
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startAll()
} else {
  window.addEventListener('DOMContentLoaded', startAll, { once: true })
}

window.addEventListener('beforeunload', () => {
  stops.forEach((s) => {
    try {
      s()
    } catch (_) {}
  })
})
