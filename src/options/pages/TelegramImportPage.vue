<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useEmojiStore } from '@/stores/emojiStore'
import {
  getTelegramBotToken,
  setTelegramBotToken,
  extractStickerSetName,
  getStickerSet,
  getFile,
  createProxyUrl,
  downloadFileAsBlob,
  type TelegramStickerSet
} from '@/utils/telegramResolver'
import { uploadServices } from '@/utils/uploadServices'
import type { EmojiGroup } from '@/types/type'
import GroupSelector from '@/options/components/GroupSelector.vue'
import * as storage from '@/utils/simpleStorage'

const store = useEmojiStore()
const route = useRoute()

// --- 状态 ---
const telegramBotToken = ref('')

// Initialize asynchronously
onMounted(async () => {
  const token = await getTelegramBotToken()
  if (token) {
    telegramBotToken.value = token
  }

  const tgInput = Array.isArray(route.query.tgInput) ? route.query.tgInput[0] : route.query.tgInput
  if (tgInput) {
    telegramInput.value = String(tgInput)
  }

  const tgGroupId = Array.isArray(route.query.tgGroupId)
    ? route.query.tgGroupId[0]
    : route.query.tgGroupId
  if (tgGroupId) {
    importMode.value = 'update'
    await nextTick()
    selectedGroupId.value = String(tgGroupId)
  }
})
const telegramInput = ref('')
const queueInput = ref('')
const isProcessing = ref(false)
const progress = ref({ processed: 0, total: 0, message: '' })
const errorMessage = ref('')
const isQueueRunning = ref(false)

// 上传服务选择
const uploadService = ref<'linux.do' | 'idcflare.com' | 'imgbed'>('linux.do')

// 导入选项
const importMode = ref<'new' | 'update'>('new')
const newGroupName = ref('')
const newGroupIcon = ref('📱')
const selectedGroupId = ref<string>('')

// 获取的贴纸集信息
const stickerSetInfo = ref<TelegramStickerSet | null>(null)

// 429 错误等待状态
const isWaitingFor429 = ref(false)
const retryAfterSeconds = ref(0)
const retryCountdown = ref(0)
let countdown429Interval: ReturnType<typeof setInterval> | null = null

// 导入取消控制
const isCancelling = ref(false)
let abortController: AbortController | null = null

// 实时导入预览列表
interface ImportingEmoji {
  id: string
  name: string
  url: string
  width: number
  height: number
}
const importingEmojis = ref<ImportingEmoji[]>([])
const showImportPreview = ref(false)

// 队列导入
type QueueStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled'
interface QueueItem {
  id: string
  input: string
  status: QueueStatus
  message?: string
}
const importQueue = ref<QueueItem[]>([])

// 预览更新节流（减少 DOM 更新频率）
let previewUpdateTimer: ReturnType<typeof setTimeout> | null = null
const pendingPreviewEmojis: ImportingEmoji[] = []

const flushPreviewUpdates = () => {
  if (pendingPreviewEmojis.length > 0) {
    importingEmojis.value.push(...pendingPreviewEmojis)
    pendingPreviewEmojis.length = 0
  }
}

const addToPreview = (emoji: ImportingEmoji) => {
  pendingPreviewEmojis.push(emoji)

  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer)
  }

  // 每 200ms 批量更新一次预览列表
  previewUpdateTimer = setTimeout(() => {
    flushPreviewUpdates()
    previewUpdateTimer = null
  }, 200)
}

const parseTelegramInputs = (value: string): string[] => {
  return value
    .split(/[\n,，\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

const enqueueInputs = () => {
  const inputs = parseTelegramInputs(queueInput.value)
  if (inputs.length === 0) {
    message.warning('请输入至少一个贴纸包链接或名称')
    return
  }

  const existing = new Set(importQueue.value.map(item => item.input))
  const newItems: QueueItem[] = []
  inputs.forEach(input => {
    if (existing.has(input)) return
    newItems.push({
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      input,
      status: 'pending'
    })
  })

  if (newItems.length === 0) {
    message.info('队列中已包含这些贴纸包')
    return
  }

  importQueue.value = [...importQueue.value, ...newItems]
  queueInput.value = ''
  message.success(`已加入 ${newItems.length} 个贴纸包到队列`)
}

const clearQueue = () => {
  if (isQueueRunning.value) {
    message.warning('队列运行中，无法清空')
    return
  }
  importQueue.value = []
}

const applyStickerSetDefaults = async (
  stickerSet: TelegramStickerSet,
  options: { forceName?: boolean } = {}
) => {
  // 自动设置分组名称为贴纸包标题
  if (options.forceName || !newGroupName.value) {
    newGroupName.value = stickerSet.title
  }

  // 检查是否已存在同名分组
  const existingGroup = store.groups.find(g => g.name === stickerSet.title)
  if (existingGroup) {
    importMode.value = 'update'
    await nextTick()
    selectedGroupId.value = existingGroup.id
  } else {
    importMode.value = 'new'
    selectedGroupId.value = ''
  }
}

const startQueueImport = async () => {
  if (!telegramBotToken.value) {
    message.error('请先设置 Telegram Bot Token')
    return
  }

  if (isProcessing.value || isQueueRunning.value) {
    message.warning('正在处理中，请稍候')
    return
  }

  if (importQueue.value.length === 0) {
    const inputs = parseTelegramInputs(queueInput.value)
    if (inputs.length > 0) {
      queueInput.value = inputs.join('\n')
      enqueueInputs()
    }
  }

  if (importQueue.value.length === 0) {
    message.warning('队列为空')
    return
  }

  isQueueRunning.value = true
  isCancelling.value = false

  for (const item of importQueue.value) {
    if (isCancelling.value) {
      item.status = 'cancelled'
      item.message = '已取消'
      break
    }
    if (item.status !== 'pending' && item.status !== 'error') continue

    item.status = 'running'
    item.message = '获取贴纸包中...'
    telegramInput.value = item.input

    const setName = extractStickerSetName(item.input)
    if (!setName) {
      item.status = 'error'
      item.message = '无效链接或名称'
      continue
    }

    let stickerSet: TelegramStickerSet | null = null
    while (!stickerSet) {
      try {
        progress.value = { processed: 0, total: 0, message: '正在获取贴纸包信息...' }
        stickerSet = await getStickerSet(setName, telegramBotToken.value)
      } catch (error: any) {
        if (error.code === 429 && error.retryAfter) {
          item.message = `请求过于频繁，等待 ${error.retryAfter} 秒`
          message.warning(`请求过于频繁，正在等待 ${error.retryAfter} 秒...`)
          await handle429Error(error.retryAfter)
          if (isCancelling.value) {
            item.status = 'cancelled'
            item.message = '已取消'
            break
          }
          continue
        }
        item.status = 'error'
        item.message = `获取失败：${error.message}`
        stickerSet = null
        break
      }
    }

    if (!stickerSet || item.status === 'cancelled') continue

    stickerSetInfo.value = stickerSet
    await applyStickerSetDefaults(stickerSet)

    const success = await doImport()
    if (isCancelling.value) {
      item.status = 'cancelled'
      item.message = '已取消'
    } else if (success) {
      item.status = 'done'
      item.message = '导入完成'
    } else {
      item.status = 'error'
      if (!item.message || item.message === '获取贴纸包中...') {
        item.message = '导入失败'
      }
    }
  }

  isQueueRunning.value = false
}

// 可用分组列表
const availableGroups = computed(() => {
  return store.groups
})

// 监控 selectedGroupId 的变化（调试用，生产环境可移除）
watch(
  selectedGroupId,
  () => {
    // 保留 watch 以便将来调试，但不输出日志
  },
  { immediate: false }
)

// 计算将要新增的表情数量（用于更新模式）
const willAddCount = computed(() => {
  if (importMode.value !== 'update' || !selectedGroupId.value || !stickerSetInfo.value) {
    return 0
  }

  const targetGroup = store.groups.find(g => g.id === selectedGroupId.value)
  if (!targetGroup) return 0

  // 获取当前分组中已有的表情基础名称（不含扩展名）
  const existingBaseNames = new Set(
    targetGroup.emojis.map(e => {
      const lastDot = e.name.lastIndexOf('.')
      return lastDot > 0 ? e.name.substring(0, lastDot) : e.name
    })
  )

  // 计算贴纸包中有多少个非视频贴纸
  const validStickers = stickerSetInfo.value.stickers.filter(s => !s.is_video)

  // 预估将要新增的数量
  let uniqueCount = 0
  validStickers.forEach((sticker, i) => {
    const baseFilename = `${sticker.emoji || 'sticker'}_${i + 1}`
    if (!existingBaseNames.has(baseFilename)) {
      uniqueCount++
    }
  })

  return uniqueCount
})

// --- 方法 ---

/**
 * 处理 429 错误，显示等待倒计时
 */
const handle429Error = async (retryAfter: number): Promise<void> => {
  isWaitingFor429.value = true
  retryAfterSeconds.value = retryAfter
  retryCountdown.value = retryAfter

  // 清理之前的 interval（防止内存泄漏）
  if (countdown429Interval) {
    clearInterval(countdown429Interval)
    countdown429Interval = null
  }

  return new Promise(resolve => {
    countdown429Interval = setInterval(() => {
      retryCountdown.value--
      // 检查是否被取消
      if (isCancelling.value) {
        if (countdown429Interval) {
          clearInterval(countdown429Interval)
          countdown429Interval = null
        }
        isWaitingFor429.value = false
        resolve()
        return
      }
      if (retryCountdown.value <= 0) {
        if (countdown429Interval) {
          clearInterval(countdown429Interval)
          countdown429Interval = null
        }
        isWaitingFor429.value = false
        resolve()
      }
    }, 1000)
  })
}

/**
 * 取消导入操作
 */
const cancelImport = () => {
  isCancelling.value = true
  if (abortController) {
    abortController.abort()
  }
  if (countdown429Interval) {
    clearInterval(countdown429Interval)
    countdown429Interval = null
  }
  isWaitingFor429.value = false
  message.warning('导入已取消')
}

/**
 * 保存 Bot Token
 */
const saveBotToken = () => {
  setTelegramBotToken(telegramBotToken.value)
  message.success('Telegram Bot Token 已保存')
}

/**
 * 预览贴纸包
 */
const previewStickerSet = async () => {
  if (isQueueRunning.value) {
    message.warning('队列运行中，暂无法预览')
    return
  }
  if (!telegramBotToken.value) {
    message.error('请先设置 Telegram Bot Token')
    return
  }

  if (!telegramInput.value) {
    message.error('请输入贴纸包链接或名称')
    return
  }

  const setName = extractStickerSetName(telegramInput.value)
  if (!setName) {
    message.error('无效的贴纸包链接或名称')
    return
  }

  isProcessing.value = true
  errorMessage.value = ''
  progress.value = { processed: 0, total: 0, message: '正在获取贴纸包信息...' }

  try {
    const stickerSet = await getStickerSet(setName, telegramBotToken.value)
    stickerSetInfo.value = stickerSet

    await applyStickerSetDefaults(stickerSet, { forceName: true })
    const existingGroup = store.groups.find(g => g.name === stickerSet.title)
    if (existingGroup) {
      message.info(`检测到已存在分组「${stickerSet.title}」，已自动切换到更新模式并选择该分组`)
    } else {
      message.success(`成功获取贴纸包：${stickerSet.title}（${stickerSet.stickers.length} 个贴纸）`)
    }
  } catch (error: any) {
    console.error('获取贴纸包失败：', error)

    // 处理 429 错误
    if (error.code === 429 && error.retryAfter) {
      errorMessage.value = `请求过于频繁，需要等待 ${error.retryAfter} 秒`
      message.warning(`请求过于频繁，正在等待 ${error.retryAfter} 秒...`)
      await handle429Error(error.retryAfter)
      // 等待完成后自动重试
      return previewStickerSet()
    }

    errorMessage.value = `获取失败：${error.message}`
    message.error(`获取失败：${error.message}`)
  } finally {
    isProcessing.value = false
  }
}

/**
 * 执行导入
 */
const doImport = async (): Promise<boolean> => {
  if (!stickerSetInfo.value) {
    message.error('请先预览贴纸包')
    return false
  }

  if (importMode.value === 'new' && !newGroupName.value.trim()) {
    message.error('请输入分组名称')
    return false
  }

  if (importMode.value === 'update' && !selectedGroupId.value) {
    message.error('请选择要更新的分组')
    return false
  }

  isProcessing.value = true
  errorMessage.value = ''
  isCancelling.value = false
  abortController = new AbortController()

  // 清空预览列表并显示预览区域
  importingEmojis.value = []
  pendingPreviewEmojis.length = 0
  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer)
    previewUpdateTimer = null
  }
  showImportPreview.value = true

  let wasCancelled = false

  try {
    const stickers = stickerSetInfo.value.stickers
    const validStickers = stickers.filter(s => !s.is_video)
    const total = validStickers.length

    progress.value = { processed: 0, total, message: '开始处理贴纸...' }

    // 开始批量操作
    store.beginBatch()

    let targetGroup: EmojiGroup | undefined

    if (importMode.value === 'new') {
      // 创建新分组
      const newGroupId = `telegram_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      targetGroup = {
        id: newGroupId,
        name: newGroupName.value.trim(),
        icon: newGroupIcon.value,
        detail: `Telegram 贴纸包：${telegramInput.value}`,
        order: store.groups.length,
        emojis: []
      }
      store.groups = [...store.groups, targetGroup]
    } else {
      // 更新已有分组
      targetGroup = store.groups.find(g => g.id === selectedGroupId.value)
      if (!targetGroup) {
        throw new Error('未找到目标分组')
      }
    }

    const newEmojis: any[] = []
    const service = uploadServices[uploadService.value]

    // 构建已有表情名称集合（用于去重检查）
    const existingEmojiNames = new Set<string>()
    const existingBaseNames = new Set<string>() // 用于快速模式匹配
    if (importMode.value === 'update' && targetGroup) {
      targetGroup.emojis.forEach(e => {
        existingEmojiNames.add(e.name)
        // 提取基础名称（不含扩展名）用于快速匹配
        const lastDot = e.name.lastIndexOf('.')
        if (lastDot > 0) {
          existingBaseNames.add(e.name.substring(0, lastDot))
        }
      })
    }

    let skippedDuplicates = 0

    // 处理每个贴纸
    for (let i = 0; i < validStickers.length; i++) {
      // 检查是否被取消
      if (isCancelling.value) {
        wasCancelled = true
        break
      }

      const sticker = validStickers[i]
      progress.value = {
        processed: i,
        total,
        message: `处理贴纸 ${i + 1}/${total}...`
      }

      try {
        // 在更新模式下，提前检查是否可能重复（基于基础文件名）
        if (importMode.value === 'update') {
          const baseFilename = `${sticker.emoji || 'sticker'}_${i + 1}`
          // 使用 Set.has() 进行 O(1) 查找，而非 Array.from().some()
          if (existingBaseNames.has(baseFilename)) {
            skippedDuplicates++
            progress.value.message = `跳过重复贴纸 ${i + 1}/${total}`
            progress.value.processed = i + 1
            continue
          }
        }

        const fileInfo = await getFile(sticker.file_id, telegramBotToken.value)
        if (!fileInfo.file_path) continue

        const extension = fileInfo.file_path.split('.').pop()?.toLowerCase() || ''
        if (extension === 'webm') continue // 跳过 webm

        // 生成文件名（与之前的逻辑一致）
        const filename = `${sticker.emoji || 'sticker'}_${i + 1}.${extension}`

        // 二次检查（精确匹配，以防模式匹配有误）
        if (importMode.value === 'update' && existingEmojiNames.has(filename)) {
          skippedDuplicates++
          progress.value.message = `跳过重复贴纸 ${i + 1}/${total}: ${filename}`
          progress.value.processed = i + 1
          continue
        }

        // 下载贴纸
        progress.value.message = `下载贴纸 ${i + 1}/${total}...`
        const proxyUrl = createProxyUrl(fileInfo.file_path, telegramBotToken.value)
        const blob = await downloadFileAsBlob(proxyUrl)

        // 确定 MIME 类型
        let mimeType = blob.type
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (extension === 'webp') mimeType = 'image/webp'
          else if (extension === 'png') mimeType = 'image/png'
          else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg'
          else if (extension === 'gif') mimeType = 'image/gif'
          else mimeType = 'image/webp' // default for stickers
        }

        // 创建 File 对象
        const file = new File([blob], filename, { type: mimeType })

        // 上传到托管服务
        progress.value.message = `上传贴纸 ${i + 1}/${total} 到 ${uploadService.value}...`
        const uploadUrl = await service.uploadFile(file, () => {
          // 上传进度回调（可用于更精细的进度显示）
        })

        const emojiId = `telegram_${sticker.file_id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        const newEmoji = {
          id: emojiId,
          packet: 0,
          name: filename,
          url: uploadUrl,
          displayUrl: uploadUrl,
          width: sticker.width,
          height: sticker.height,
          groupId: targetGroup!.id
        }

        newEmojis.push(newEmoji)

        // 添加到本地分组对象（延迟更新 store 以减少重新渲染）
        targetGroup!.emojis.push(newEmoji)

        // 使用节流方式添加到预览列表
        addToPreview({
          id: emojiId,
          name: filename,
          url: uploadUrl,
          width: sticker.width,
          height: sticker.height
        })

        progress.value.processed = i + 1
      } catch (err: any) {
        console.error(`处理贴纸失败：`, err)

        // 处理 429 错误
        if (err.code === 429 && err.retryAfter) {
          message.warning(`请求过于频繁，等待 ${err.retryAfter} 秒后继续...`)
          await handle429Error(err.retryAfter)
          // 重试当前贴纸
          i--
          continue
        }

        message.warning(`贴纸 ${i + 1} 上传失败，已跳过`)
      }
    }

    // 统计导入结果
    const addedCount = newEmojis.length
    const skippedCount = skippedDuplicates

    // 刷新所有待处理的预览更新
    if (previewUpdateTimer) {
      clearTimeout(previewUpdateTimer)
      previewUpdateTimer = null
    }
    flushPreviewUpdates()

    // 【关键】一次性更新 store.groups 以减少重新渲染
    // 找到分组在 store.groups 中的位置并更新整个数组引用
    const groupIndex = store.groups.findIndex(g => g.id === targetGroup!.id)
    if (groupIndex !== -1) {
      // 创建新的 groups 数组以触发 shallowRef 响应式
      store.groups = [
        ...store.groups.slice(0, groupIndex),
        { ...targetGroup! }, // 浅拷贝分组对象
        ...store.groups.slice(groupIndex + 1)
      ]
    }

    // 保存分组到存储
    // 由于批量操作期间不会自动保存，需要手动调用
    await store.saveGroup(targetGroup!.id)

    // 如果是新分组，还需要更新分组索引
    if (importMode.value === 'new') {
      const index = store.groups.map((g, order) => ({ id: g.id, order }))
      await storage.setEmojiGroupIndex(index)
    }

    // 结束批量操作
    await store.endBatch()

    if (wasCancelled) {
      message.warning(`已取消导入（已处理 ${addedCount} 个贴纸）`)
      return false
    }

    // 显示成功消息
    if (importMode.value === 'new') {
      message.success(`成功导入分组：${targetGroup!.name}（${addedCount} 个贴纸）`)
    } else {
      if (skippedCount > 0) {
        message.success(
          `成功更新分组：${targetGroup!.name}（新增 ${addedCount} 个，跳过 ${skippedCount} 个重复贴纸）`
        )
      } else {
        message.success(`成功更新分组：${targetGroup!.name}（新增 ${addedCount} 个贴纸）`)
      }
    }

    // 重置状态
    stickerSetInfo.value = null
    telegramInput.value = ''
    newGroupName.value = ''
    selectedGroupId.value = ''
    importMode.value = 'new'
    return true
  } catch (error: any) {
    console.error('导入失败：', error)
    errorMessage.value = `导入失败：${error.message}`
    message.error(`导入失败：${error.message}`)
    store.endBatch()
    return false
  } finally {
    isProcessing.value = false
    isCancelling.value = false
    abortController = null
  }
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-4xl mx-auto">
      <!-- 页面标题 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Telegram 贴纸导入</h1>
        <p class="text-gray-600 dark:text-gray-400">一键从 Telegram 贴纸包导入或更新表情分组</p>
      </div>

      <!-- 错误信息 -->
      <div
        v-if="errorMessage"
        class="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md"
      >
        <p class="text-red-800 dark:text-red-200">{{ errorMessage }}</p>
      </div>

      <!-- 主要内容区域 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        <!-- Bot Token 设置 -->
        <div
          class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
        >
          <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3">1️⃣ Bot Token 设置</h4>
          <div class="flex gap-2">
            <a-input-password
              v-model:value="telegramBotToken"
              placeholder="输入 Telegram Bot Token"
              class="flex-1"
            />
            <a-button type="primary" @click="saveBotToken" :disabled="!telegramBotToken">
              保存
            </a-button>
          </div>
          <p class="text-xs text-blue-700 dark:text-blue-300 mt-2">
            在 Telegram 中搜索 @BotFather，发送 /newbot 创建机器人获取 Token
          </p>
        </div>

        <!-- 上传服务选择 -->
        <div
          class="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md"
        >
          <h4 class="font-medium text-purple-900 dark:text-purple-100 mb-3">2️⃣ 选择上传服务</h4>
          <a-radio-group v-model:value="uploadService">
            <a-radio-button value="linux.do">linux.do</a-radio-button>
            <a-radio-button value="idcflare.com">idcflare.com</a-radio-button>
            <a-radio-button value="imgbed">imgbed</a-radio-button>
          </a-radio-group>
          <p class="text-xs text-purple-700 dark:text-purple-300 mt-2">
            贴纸将自动上传到所选服务并保存托管链接
          </p>
        </div>

        <!-- 贴纸包输入 -->
        <div>
          <h4 class="font-medium text-gray-900 dark:text-white mb-3">3️⃣ 输入贴纸包链接或名称</h4>
          <div class="flex gap-2">
            <a-input
              v-model:value="telegramInput"
              placeholder="例如：https://t.me/addstickers/xxx 或 xxx"
              @pressEnter="previewStickerSet"
            />
            <a-button
              type="primary"
              @click="previewStickerSet"
              :disabled="!telegramInput || isProcessing || isQueueRunning"
              :loading="isProcessing"
            >
              预览
            </a-button>
          </div>
        </div>

        <!-- 队列导入 -->
        <div
          class="p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-md"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium text-gray-900 dark:text-white">3️⃣-A 批量队列导入</h4>
            <div class="flex gap-2">
              <a-button
                size="small"
                @click="enqueueInputs"
                :disabled="isProcessing || isQueueRunning"
              >
                加入队列
              </a-button>
              <a-button
                size="small"
                type="primary"
                @click="startQueueImport"
                :disabled="isProcessing || isQueueRunning"
                :loading="isQueueRunning"
              >
                开始队列导入
              </a-button>
              <a-button size="small" danger @click="clearQueue" :disabled="isQueueRunning">
                清空队列
              </a-button>
            </div>
          </div>
          <a-textarea
            v-model:value="queueInput"
            :rows="3"
            placeholder="多行输入，每行一个贴纸包链接或名称，例如：https://t.me/addstickers/xxx"
          />
          <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
            队列会按顺序依次导入；同名分组会自动切换到更新模式
          </p>

          <div v-if="importQueue.length > 0" class="mt-3 space-y-2">
            <div
              v-for="item in importQueue"
              :key="item.id"
              class="flex items-center justify-between gap-3 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
            >
              <div class="flex-1 truncate text-sm text-gray-800 dark:text-gray-200">
                {{ item.input }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ item.message }}</div>
              <a-tag
                :color="
                  item.status === 'done'
                    ? 'green'
                    : item.status === 'running'
                      ? 'blue'
                      : item.status === 'error'
                        ? 'red'
                        : item.status === 'cancelled'
                          ? 'orange'
                          : 'default'
                "
              >
                {{
                  item.status === 'done'
                    ? '完成'
                    : item.status === 'running'
                      ? '进行中'
                      : item.status === 'error'
                        ? '失败'
                        : item.status === 'cancelled'
                          ? '已取消'
                          : '待处理'
                }}
              </a-tag>
            </div>
          </div>
        </div>

        <!-- 进度显示 -->
        <div
          v-if="isProcessing && progress.message"
          class="p-3 bg-gray-100 dark:bg-gray-700 rounded-md"
        >
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ progress.message }}</p>
            <a-button size="small" danger @click="cancelImport" :disabled="isCancelling">
              {{ isCancelling ? '取消中...' : '取消导入' }}
            </a-button>
          </div>
          <div v-if="progress.total > 0" class="flex items-center gap-2">
            <div class="flex-1 bg-gray-300 dark:bg-gray-600 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all"
                :style="{ width: `${(progress.processed / progress.total) * 100}%` }"
              ></div>
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400">
              {{ progress.processed }}/{{ progress.total }}
            </span>
          </div>
        </div>

        <!-- 429 等待进度条 -->
        <div
          v-if="isWaitingFor429"
          class="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md"
        >
          <div class="flex items-center gap-2 mb-3">
            <svg
              class="animate-spin h-5 w-5 text-orange-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p class="text-sm font-medium text-orange-900 dark:text-orange-100">
              请求过于频繁，等待中...
            </p>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-xs text-orange-700 dark:text-orange-300">
              <span>剩余时间：{{ retryCountdown }} 秒</span>
              <span>总计：{{ retryAfterSeconds }} 秒</span>
            </div>
            <a-progress
              :percent="((retryAfterSeconds - retryCountdown) / retryAfterSeconds) * 100"
              :show-info="false"
              status="active"
              stroke-color="#f97316"
            />
          </div>
        </div>

        <!-- 贴纸包预览 -->
        <div v-if="stickerSetInfo" class="space-y-4">
          <div
            class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md"
          >
            <h4 class="font-medium text-green-900 dark:text-green-100 mb-2">
              {{ stickerSetInfo.title }}
            </h4>
            <p class="text-sm text-green-800 dark:text-green-200">
              {{ stickerSetInfo.stickers.length }} 个贴纸
              <span v-if="stickerSetInfo.is_animated">(包含动画贴纸)</span>
              <span v-if="stickerSetInfo.is_video">(包含视频贴纸)</span>
            </p>
          </div>

          <!-- 导入选项 -->
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-3">4️⃣ 导入模式</h4>
            <a-radio-group v-model:value="importMode" class="mb-4">
              <a-radio value="new">新建分组</a-radio>
              <a-radio value="update">更新已有分组</a-radio>
            </a-radio-group>

            <!-- 新建分组选项 -->
            <div v-if="importMode === 'new'" class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                  分组名称
                </label>
                <a-input v-model:value="newGroupName" placeholder="输入分组名称" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                  分组图标
                </label>
                <a-input v-model:value="newGroupIcon" placeholder="输入 emoji 图标" />
              </div>
            </div>

            <!-- 更新分组选项 -->
            <div v-if="importMode === 'update'" class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                选择要更新的分组
              </label>
              <GroupSelector
                v-model="selectedGroupId"
                :groups="availableGroups"
                placeholder="请选择分组"
              />
              <!-- 显示将要新增的表情数量 -->
              <div
                v-if="selectedGroupId && willAddCount > 0"
                class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-200"
              >
                <span class="font-medium">即将新增 {{ willAddCount }} 个表情</span>
                <span class="text-xs ml-1">(已自动过滤重复)</span>
              </div>
              <div
                v-else-if="selectedGroupId && willAddCount === 0"
                class="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200"
              >
                <span>该分组已包含所有贴纸，无需重复导入</span>
              </div>
            </div>
          </div>

          <!-- 导入按钮 -->
          <div class="flex justify-end">
            <a-button
              type="primary"
              size="large"
              @click="doImport"
              :disabled="
                !stickerSetInfo ||
                isProcessing ||
                isQueueRunning ||
                (importMode === 'new' && !newGroupName.trim()) ||
                (importMode === 'update' && !selectedGroupId)
              "
              :loading="isProcessing"
            >
              {{ importMode === 'new' ? '导入到新分组' : '更新分组' }}
            </a-button>
          </div>

          <!-- 实时导入预览 -->
          <div
            v-if="showImportPreview && importingEmojis.length > 0"
            class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
          >
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-medium text-blue-900 dark:text-blue-100">
                正在导入的表情 ({{ importingEmojis.length }})
              </h4>
              <a-button v-if="!isProcessing" size="small" @click="showImportPreview = false">
                关闭预览
              </a-button>
            </div>
            <div
              class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto"
            >
              <div
                v-for="emoji in importingEmojis"
                :key="emoji.id"
                class="flex flex-col items-center p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                <div
                  class="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded"
                >
                  <img
                    :src="emoji.url"
                    :alt="emoji.name"
                    class="max-w-full max-h-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <span
                  class="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center truncate w-full"
                >
                  {{ emoji.name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
