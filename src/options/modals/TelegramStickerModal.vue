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

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue', 'imported'])

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

// 可用分组列表
const availableGroups = computed(() => {
  return store.groups
})

// --- 方法 ---

/**
 * 保存 Bot Token
 */
const saveBotToken = () => {
  setTelegramBotToken(telegramBotToken.value)
  message.success('Telegram Bot Token 已保存')
}

/**
 * 关闭模态框
 */
const close = () => {
  emit('update:modelValue', false)
  // 重置状态
  telegramInput.value = ''
  errorMessage.value = ''
  progress.value = { processed: 0, total: 0, message: '' }
  stickerSetInfo.value = null
  importMode.value = 'new'
  newGroupName.value = ''
  newGroupIcon.value = '📱'
  selectedGroupId.value = ''
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
      } catch (err) {
        console.error(`处理贴纸失败：`, err)
        message.warning(`贴纸 ${i + 1} 上传失败，已跳过`)
      }
    }

    // 更新分组中的 emojis
    if (importMode.value === 'new') {
      targetGroup!.emojis = newEmojis
    } else {
      // 更新模式：合并新旧 emoji，避免重复
      const existingEmojiNames = new Set(targetGroup!.emojis.map(e => e.name))
      const uniqueNewEmojis = newEmojis.filter(e => !existingEmojiNames.has(e.name))
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

    message.success(
      `成功${importMode.value === 'new' ? '导入' : '更新'}分组：${targetGroup!.name}（${newEmojis.length} 个贴纸）`
    )

    emit('imported', {
      groupId: targetGroup!.id,
      mode: importMode.value,
      count: newEmojis.length
    })

    close()
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
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      @click.stop
    >
      <div class="flex-shrink-0 mb-4">
        <h3 class="text-xl font-semibold mb-4 dark:text-white">导入 Telegram 贴纸包</h3>

        <!-- 错误信息 -->
        <div
          v-if="errorMessage"
          class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md"
        >
          <p class="text-sm text-red-800 dark:text-red-200">{{ errorMessage }}</p>
        </div>

        <!-- Bot Token 设置 -->
        <div
          class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
        >
          <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3">Bot Token 设置</h4>
          <div class="flex gap-2">
            <input
              v-model="telegramBotToken"
              type="password"
              placeholder="输入 Telegram Bot Token"
              class="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-black text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              @click="saveBotToken"
              :disabled="!telegramBotToken"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </div>

        <!-- 上传服务选择 -->
        <div
          class="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md"
        >
          <h4 class="font-medium text-purple-900 dark:text-purple-100 mb-3">选择上传服务</h4>
          <div class="flex gap-2">
            <label class="flex items-center cursor-pointer">
              <input v-model="uploadService" type="radio" value="linux.do" class="mr-2" />
              <span class="text-gray-700 dark:text-gray-300">linux.do</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input v-model="uploadService" type="radio" value="idcflare.com" class="mr-2" />
              <span class="text-gray-700 dark:text-gray-300">idcflare.com</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input v-model="uploadService" type="radio" value="imgbed" class="mr-2" />
              <span class="text-gray-700 dark:text-gray-300">imgbed</span>
            </label>
          </div>
          <p class="text-xs text-purple-700 dark:text-purple-300 mt-2">
            贴纸将自动上传到所选服务并保存托管链接
          </p>
        </div>

        <!-- 贴纸包输入 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            贴纸包链接或名称
          </label>
          <div class="flex gap-2">
            <input
              v-model="telegramInput"
              type="text"
              placeholder="例如：https://t.me/addstickers/xxx 或 xxx"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              @keyup.enter="previewStickerSet"
            />
            <button
              @click="previewStickerSet"
              :disabled="!telegramInput || isProcessing"
              class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              预览
            </button>
          </div>
        </div>

        <!-- 进度显示 -->
        <div
          v-if="isProcessing && progress.message"
          class="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md"
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
      </div>

      <!-- 贴纸包预览 -->
      <div v-if="stickerSetInfo" class="flex-1 overflow-y-auto">
        <div
          class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md"
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
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            导入模式
          </label>
          <div class="flex gap-4">
            <label class="flex items-center cursor-pointer">
              <input v-model="importMode" type="radio" value="new" class="mr-2" />
              <span class="text-gray-700 dark:text-gray-300">新建分组</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input v-model="importMode" type="radio" value="update" class="mr-2" />
              <span class="text-gray-700 dark:text-gray-300">更新已有分组</span>
            </label>
          </div>
        </div>

        <!-- 新建分组选项 -->
        <div v-if="importMode === 'new'" class="mb-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
              分组名称
            </label>
            <input
              v-model="newGroupName"
              type="text"
              placeholder="输入分组名称"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
              分组图标
            </label>
            <input
              v-model="newGroupIcon"
              type="text"
              placeholder="输入 emoji 图标"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <!-- 更新分组选项 -->
        <div v-if="importMode === 'update'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-1">
            选择要更新的分组
          </label>
          <select
            v-model="selectedGroupId"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-black text-gray-900 dark:text-white"
          >
            <option value="">请选择分组</option>
            <option v-for="group in availableGroups" :key="group.id" :value="group.id">
              {{ group.icon }} {{ group.name }} ({{ group.emojis.length }} 个表情)
            </option>
          </select>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex justify-end gap-3 mt-4">
        <button
          @click="close"
          :disabled="isProcessing"
          class="px-4 py-2 text-sm text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <button
          @click="doImport"
          :disabled="
            !stickerSetInfo ||
            isProcessing ||
            (importMode === 'new' && !newGroupName.trim()) ||
            (importMode === 'update' && !selectedGroupId)
          "
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ importMode === 'new' ? '导入到新分组' : '更新分组' }}
        </button>
      </div>
    </div>
  </div>
</template>
