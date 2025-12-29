/**
 * useTimeout / useInterval - 自动清理的定时器 composables
 * 在组件卸载时自动清理，防止内存泄漏
 */

import { onBeforeUnmount, ref } from 'vue'

/**
 * 自动清理的 setTimeout
 */
export function useTimeout(callback: () => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const isActive = ref(false)

  const start = () => {
    if (timeoutId !== null) return

    isActive.value = true
    timeoutId = setTimeout(() => {
      isActive.value = false
      callback()
      timeoutId = null
    }, delay)
  }

  const stop = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
      isActive.value = false
    }
  }

  // 自动在组件卸载时清理
  onBeforeUnmount(() => {
    stop()
  })

  return {
    isActive,
    start,
    stop
  }
}

/**
 * 自动清理的 setInterval
 */
export function useInterval(callback: () => void, delay: number) {
  let intervalId: ReturnType<typeof setInterval> | null = null
  const isActive = ref(false)

  const start = () => {
    if (intervalId !== null) return

    isActive.value = true
    intervalId = setInterval(callback, delay)
  }

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
      isActive.value = false
    }
  }

  // 自动在组件卸载时清理
  onBeforeUnmount(() => {
    stop()
  })

  return {
    isActive,
    start,
    stop
  }
}

/**
 * 自动清理的 requestAnimationFrame
 */
export function useRafFn(callback: (timestamp: number) => void) {
  let rafId: number | null = null
  const isActive = ref(false)

  const loop = (timestamp: number) => {
    if (!isActive.value) return

    callback(timestamp)
    rafId = requestAnimationFrame(loop)
  }

  const start = () => {
    if (isActive.value) return

    isActive.value = true
    rafId = requestAnimationFrame(loop)
  }

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isActive.value = false
  }

  // 自动在组件卸载时清理
  onBeforeUnmount(() => {
    stop()
  })

  return {
    isActive,
    start,
    stop
  }
}
