import { ref } from 'vue'

import {
  processTelegramStickers,
  getTelegramBotToken,
  setTelegramBotToken
} from '@/utils/telegramResolver'

/**
 * Telegram 贴纸导入 Composable
 * 负责管理 Telegram 贴纸解析和导入逻辑
 */

interface TelegramProgress {
  processed: number
  total: number
  message: string
}

export function useTelegramImport() {
  // --- 状态 ---
  const telegramBotToken = ref(getTelegramBotToken() || '')
  const showTelegramModal = ref(false)
  const telegramInput = ref('')
  const isProcessingTelegram = ref(false)
  const telegramProgress = ref<TelegramProgress>({ processed: 0, total: 0, message: '' })

  // --- 方法 ---

  /**
   * 保存 Bot Token
   */
  const saveBotToken = () => {
    setTelegramBotToken(telegramBotToken.value)
    message.success('Telegram Bot Token 已保存')
  }

  /**
   * 处理 Telegram 导入
   * @param onFilesReady 当文件准备好时的回调
   */
  const handleTelegramImport = async (onFilesReady: (files: File[]) => Promise<void>) => {
    console.log('[useTelegramImport] handleTelegramImport called')

    if (!telegramBotToken.value) {
      message.error('请先设置 Telegram Bot Token')
      return
    }

    if (!telegramInput.value) {
      message.error('请输入贴纸包链接或名称')
      return
    }

    console.log('[useTelegramImport] Starting Telegram import:', telegramInput.value)
    isProcessingTelegram.value = true
    telegramProgress.value = { processed: 0, total: 0, message: '开始解析...' }

    try {
      console.log('[useTelegramImport] Calling processTelegramStickers...')
      const files = await processTelegramStickers(
        telegramInput.value,
        telegramBotToken.value,
        (processed, total, msg) => {
          console.log(`[useTelegramImport] Progress: ${processed}/${total} - ${msg}`)
          telegramProgress.value = { processed, total, message: msg }
        }
      )

      console.log(`[useTelegramImport] processTelegramStickers returned ${files.length} files`)

      if (files.length > 0) {
        console.log(`[useTelegramImport] Adding ${files.length} files`)
        await onFilesReady(files)
        message.success(`成功添加 ${files.length} 个贴纸文件，请点击上传按钮`)
        showTelegramModal.value = false
        telegramInput.value = ''
      } else {
        message.warning('未能找到符合条件的表情（可能跳过了不支持的格式）')
      }
    } catch (error: any) {
      console.error('[useTelegramImport] Telegram import failed:', error)
      message.error(`导入失败：${error.message}`)
    } finally {
      isProcessingTelegram.value = false
    }
  }

  /**
   * 打开 Telegram 导入模态框
   */
  const openTelegramModal = () => {
    showTelegramModal.value = true
  }

  /**
   * 关闭 Telegram 导入模态框
   */
  const closeTelegramModal = () => {
    showTelegramModal.value = false
    telegramInput.value = ''
    telegramProgress.value = { processed: 0, total: 0, message: '' }
  }

  return {
    // State
    telegramBotToken,
    showTelegramModal,
    telegramInput,
    isProcessingTelegram,
    telegramProgress,

    // Methods
    saveBotToken,
    handleTelegramImport,
    openTelegramModal,
    closeTelegramModal
  }
}
