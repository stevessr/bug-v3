import { ref } from 'vue'

import type { EmojiGroup } from '@/types/type'

/**
 * 导出进度管理 Composable
 * 负责管理导出操作的进度显示、取消控制和模态框状态
 */
export function useExportProgress() {
  // --- Export Progress State ---
  const exportProgress = ref<number>(0)
  const exportProgressGroupId = ref<string | null>(null)

  // --- Export Modal State ---
  const showExportModal = ref(false)
  const exportModalPercent = ref(0)
  const exportModalCurrentName = ref<string | null>(null)
  const exportModalCurrentPreview = ref<string | null>(null)
  const exportModalCancelled = ref(false)
  const exportModalPreviews = ref<string[]>([])
  const exportModalNames = ref<string[]>([])

  // --- Abort Controller ---
  let exportAbortController: AbortController | null = null

  // --- Progress Management Methods ---

  /**
   * 初始化导出进度状态（在开始新导出前调用）
   */
  const initExportProgress = (groupId: string) => {
    exportAbortController = new AbortController()
    exportProgressGroupId.value = groupId
    exportProgress.value = 0
    exportModalCancelled.value = false
    exportModalPercent.value = 0
    exportModalCurrentName.value = null
    exportModalCurrentPreview.value = null
    exportModalPreviews.value = []
    exportModalNames.value = []
    showExportModal.value = true

    return exportAbortController.signal
  }

  /**
   * 更新导出进度百分比
   */
  const updateProgress = (percent: number) => {
    exportProgress.value = Math.max(0, Math.min(100, Math.round(percent)))
    exportModalPercent.value = exportProgress.value
  }

  /**
   * 更新当前导出项信息
   */
  const updateCurrentItem = (info: { index: number; name: string; preview?: string | null }) => {
    if (exportModalCancelled.value) return

    // 添加到历史数组
    exportModalNames.value.push(info.name)
    exportModalPreviews.value.push(info.preview || '')

    // 更新当前显示
    exportModalCurrentName.value = info.name
    exportModalCurrentPreview.value = info.preview || null
  }

  /**
   * 更新当前项（用于流式处理，防止重复）
   */
  const updateCurrentItemDebounced = (
    info: {
      name?: string
      preview?: string
    },
    lastProgressUpdate: { value: number },
    minInterval = 100
  ) => {
    if (exportModalCancelled.value) return false

    const now = Date.now()
    const shouldUpdate = now - lastProgressUpdate.value >= minInterval

    if (shouldUpdate || !lastProgressUpdate.value) {
      // 更新名称（防止重复）
      if (info.name && info.name !== exportModalCurrentName.value) {
        exportModalCurrentName.value = info.name
        if (!exportModalNames.value.includes(info.name)) {
          exportModalNames.value.push(info.name)
        }
      }

      // 更新预览（防止重复）
      if (info.preview && info.preview !== exportModalCurrentPreview.value) {
        exportModalCurrentPreview.value = info.preview
        if (!exportModalPreviews.value.includes(info.preview)) {
          exportModalPreviews.value.push(info.preview)
        }
      }

      lastProgressUpdate.value = now
      return true
    }

    return false
  }

  /**
   * 完成导出（100% 进度）
   */
  const completeExport = () => {
    exportProgress.value = 100
    exportModalPercent.value = 100
  }

  /**
   * 重置导出状态（在短暂延迟后调用）
   */
  const resetExportState = (hideDelay = 800, cleanupDelay = 600) => {
    setTimeout(() => {
      exportProgressGroupId.value = null
      exportProgress.value = 0

      setTimeout(() => {
        // 释放预览 URL
        try {
          exportModalPreviews.value.forEach(url => {
            try {
              if (url) URL.revokeObjectURL(url)
            } catch {
              /* ignore */
            }
          })
        } catch {
          /* ignore */
        }

        // 重置模态框状态
        showExportModal.value = false
        exportModalCurrentName.value = null
        exportModalCurrentPreview.value = null
        exportModalPercent.value = 0
        exportModalCancelled.value = false
        exportModalPreviews.value = []
        exportModalNames.value = []

        // 清理 abort controller
        if (exportAbortController) {
          exportAbortController = null
        }
      }, cleanupDelay)
    }, hideDelay)
  }

  /**
   * 取消导出
   */
  const cancelExport = () => {
    exportModalCancelled.value = true
    if (exportAbortController) {
      try {
        exportAbortController.abort()
      } catch {
        /* ignore */
      }
    }

    // 释放预览 URL
    try {
      exportModalPreviews.value.forEach(url => {
        try {
          if (url) URL.revokeObjectURL(url)
        } catch {
          /* ignore */
        }
      })
    } catch {
      /* ignore */
    }

    // 重置状态
    exportModalCurrentName.value = null
    exportModalCurrentPreview.value = null
    exportModalPercent.value = 0
    exportModalPreviews.value = []
    exportModalNames.value = []
    showExportModal.value = false
    exportAbortController = null
  }

  /**
   * 关闭导出模态框
   */
  const closeExportModal = () => {
    // 如果正在导出，取消它
    if (exportAbortController && !exportModalCancelled.value) {
      cancelExport()
    } else {
      // 否则只是关闭模态框
      showExportModal.value = false
    }
  }

  return {
    // State
    exportProgress,
    exportProgressGroupId,
    showExportModal,
    exportModalPercent,
    exportModalCurrentName,
    exportModalCurrentPreview,
    exportModalCancelled,
    exportModalPreviews,
    exportModalNames,

    // Methods
    initExportProgress,
    updateProgress,
    updateCurrentItem,
    updateCurrentItemDebounced,
    completeExport,
    resetExportState,
    cancelExport,
    closeExportModal,

    // Computed getter for abort signal (for convenience)
    get abortSignal() {
      return exportAbortController?.signal
    }
  }
}
