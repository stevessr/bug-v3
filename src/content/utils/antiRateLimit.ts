// antiRateLimit: removed network interception logic

// Keep a minimal exported API so other modules depending on this file do not break.
export function initAntiRateLimit() {
  console.log('[Anti-RateLimit] disabled: initAntiRateLimit is noop')
}

export function manualTriggerChallenge() {
  console.log('[Anti-RateLimit] manualTriggerChallenge called but network interception is removed')
}

