<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'

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

const store = useEmojiStore()

// --- 状态 ---
const telegramBotToken = ref(getTelegramBotToken() || '')
const telegramInput = ref('')
const isProcessing = ref(false)
const progress = ref({ processed: 0, total: 0, message: '' })
const errorMessage = ref('')

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

// 可用分组列表
const availableGroups = computed(() => {
  return store.groups
})

// --- 方法 ---

/**
 * 处理 429 错误，显示等待倒计时
 */
const handle429Error = async (retryAfter: number): Promise<void> => {
  isWaitingFor429.value = true
  retryAfterSeconds.value = retryAfter
  retryCountdown.value = retryAfter

  return new Promise(resolve => {
    const interval = setInterval(() => {
      retryCountdown.value--
      if (retryCountdown.value <= 0) {
        clearInterval(interval)
        isWaitingFor429.value = false
        resolve()
      }
    }, 1000)
  })
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

    // 自动设置分组名称为贴纸包标题
    if (!newGroupName.value) {
      newGroupName.value = stickerSet.title
    }

    // 检查是否已存在同名分组
    const existingGroup = store.groups.find(g => g.name === stickerSet.title)
    if (existingGroup) {
      importMode.value = 'update'
      selectedGroupId.value = existingGroup.id
      message.info(`检测到已存在分组「${stickerSet.title}」，已切换到更新模式`)
    }

    message.success(`成功获取贴纸包：${stickerSet.title}（${stickerSet.stickers.length} 个贴纸）`)
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
const doImport = async () => {
  if (!stickerSetInfo.value) {
    message.error('请先预览贴纸包')
    return
  }

  if (importMode.value === 'new' && !newGroupName.value.trim()) {
    message.error('请输入分组名称')
    return
  }

  if (importMode.value === 'update' && !selectedGroupId.value) {
    message.error('请选择要更新的分组')
    return
  }

  isProcessing.value = true
  errorMessage.value = ''

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

    // 处理每个贴纸
    for (let i = 0; i < validStickers.length; i++) {
      const sticker = validStickers[i]
      progress.value = {
        processed: i,
        total,
        message: `下载并上传贴纸 ${i + 1}/${total}...`
      }

      try {
        const fileInfo = await getFile(sticker.file_id, telegramBotToken.value)
        if (!fileInfo.file_path) continue

        const extension = fileInfo.file_path.split('.').pop()?.toLowerCase() || ''
        if (extension === 'webm') continue // 跳过 webm

        // 下载贴纸
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
        const filename = `${sticker.emoji || 'sticker'}_${i + 1}.${extension}`
        const file = new File([blob], filename, { type: mimeType })

        // 上传到托管服务
        progress.value.message = `上传贴纸 ${i + 1}/${total} 到 ${uploadService.value}...`
        const uploadUrl = await service.uploadFile(file, percent => {
          console.log(`Upload progress: ${percent}%`)
        })

        const emojiId = `telegram_${sticker.file_id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        newEmojis.push({
          id: emojiId,
          name: filename,
          url: uploadUrl,
          displayUrl: uploadUrl,
          groupId: targetGroup!.id
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

    // 更新分组中的 emojis
    let addedCount = 0
    let skippedCount = 0

    if (importMode.value === 'new') {
      targetGroup!.emojis = newEmojis
      addedCount = newEmojis.length
    } else {
      // 更新模式：合并新旧 emoji，避免重复
      const existingEmojiNames = new Set(targetGroup!.emojis.map(e => e.name))
      const uniqueNewEmojis = newEmojis.filter(e => !existingEmojiNames.has(e.name))
      skippedCount = newEmojis.length - uniqueNewEmojis.length
      addedCount = uniqueNewEmojis.length

      targetGroup!.emojis = [...targetGroup!.emojis, ...uniqueNewEmojis]

      // 更新 groups 引用以触发响应式
      const groupIndex = store.groups.findIndex(g => g.id === targetGroup!.id)
      if (groupIndex !== -1) {
        store.groups = [
          ...store.groups.slice(0, groupIndex),
          { ...targetGroup! },
          ...store.groups.slice(groupIndex + 1)
        ]
      }
    }

    // 结束批量操作并保存
    await store.endBatch()

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
  } catch (error: any) {
    console.error('导入失败：', error)
    errorMessage.value = `导入失败：${error.message}`
    message.error(`导入失败：${error.message}`)
    store.endBatch()
  } finally {
    isProcessing.value = false
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
              :disabled="!telegramInput || isProcessing"
              :loading="isProcessing"
            >
              预览
            </a-button>
          </div>
        </div>

        <!-- 进度显示 -->
        <div
          v-if="isProcessing && progress.message"
          class="p-3 bg-gray-100 dark:bg-gray-700 rounded-md"
        >
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ progress.message }}</p>
          <div v-if="progress.total > 0" class="mt-2 flex items-center gap-2">
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
            <div v-if="importMode === 'update'">
              <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                选择要更新的分组
              </label>
              <GroupSelector
                v-model="selectedGroupId"
                :groups="availableGroups"
                placeholder="请选择分组"
              />
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
                (importMode === 'new' && !newGroupName.trim()) ||
                (importMode === 'update' && !selectedGroupId)
              "
              :loading="isProcessing"
            >
              {{ importMode === 'new' ? '导入到新分组' : '更新分组' }}
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
