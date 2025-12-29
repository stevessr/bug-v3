/**
 * useEventListener - 自动清理的事件监听器 composable
 * 在组件卸载时自动移除监听器，防止内存泄漏
 */

import { onBeforeUnmount, onUnmounted } from 'vue'

interface EventListenerOptions extends AddEventListenerOptions {
  // 可扩展选项
}

/**
 * 添加事件监听器，并在组件卸载时自动清理
 */
export function useEventListener(
  target: EventTarget | null | undefined,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions
): () => void {
  let cleanup: (() => void) | null = null

  if (target) {
    target.addEventListener(event, handler, options)

    cleanup = () => {
      if (target) {
        target.removeEventListener(event, handler, options)
      }
    }

    // 自动在组件卸载时清理
    onBeforeUnmount(() => {
      cleanup?.()
    })
  }

  // 返回手动清理函数（如果需要提前清理）
  return () => {
    cleanup?.()
    cleanup = null
  }
}

/**
 * 使用 AbortController 管理多个事件监听器
 */
export function useAbortController() {
  let controller: AbortController | null = new AbortController()

  const getSignal = () => controller?.signal

  const abort = () => {
    if (controller) {
      controller.abort()
      controller = null
    }
  }

  const reset = () => {
    abort()
    controller = new AbortController()
  }

  // 自动在组件卸载时清理
  onUnmounted(() => {
    abort()
  })

  return {
    signal: getSignal,
    abort,
    reset
  }
}
