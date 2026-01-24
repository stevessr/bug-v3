<script setup lang="ts">
import { ref, computed, isRef } from 'vue'
import {
  QuestionCircleOutlined,
  CloudUploadOutlined,
  SearchOutlined,
  SaveOutlined,
  FileImageOutlined
} from '@ant-design/icons-vue'

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
import { convertWebmToAvifViaBackend } from '@/utils/webmToAvifBackend'
import { uploadServices } from '@/utils/uploadServices'
import type { EmojiGroup } from '@/types/type'
import { defaultSettings } from '@/types/defaultSettings'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue', 'imported'])

const store = useEmojiStore()
const safeSettings = computed(() =>
  (isRef(store.settings) ? store.settings.value : store.settings) || defaultSettings
)

const allowVideoStickers = computed(() => {
  const enabled = !!safeSettings.value.telegramWebmToAvifEnabled
  const backend = safeSettings.value.telegramWebmToAvifBackend || ''
  return enabled && backend.trim().length > 0
})

const webmToAvifBackend = computed(() => safeSettings.value.telegramWebmToAvifBackend || '')

// --- 状态 ---
const telegramBotToken = ref('')
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

// Modal visibility wrapper
const isOpen = computed({
  get: () => props.modelValue,
  set: val => {
    if (!val) close()
    else emit('update:modelValue', val)
  }
})

// Initialize token
getTelegramBotToken()
  .then(token => {
    if (token) telegramBotToken.value = token
  })
  .catch(console.error)

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
  if (!isProcessing.value) {
    telegramInput.value = ''
    errorMessage.value = ''
    progress.value = { processed: 0, total: 0, message: '' }
    stickerSetInfo.value = null
    importMode.value = 'new'
    newGroupName.value = ''
    newGroupIcon.value = '📱'
    selectedGroupId.value = ''
  }
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
    const validStickers = stickers.filter(s => allowVideoStickers.value || !s.is_video)
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

        let extension = fileInfo.file_path.split('.').pop()?.toLowerCase() || ''
        if (extension === 'webm' && !allowVideoStickers.value) continue

        // 下载贴纸
        const proxyUrl = createProxyUrl(fileInfo.file_path, telegramBotToken.value)
        let blob = await downloadFileAsBlob(proxyUrl)

        if (extension === 'webm') {
          try {
            progress.value.message = `转换 WebM ${i + 1}/${total}...`
            blob = await convertWebmToAvifViaBackend(blob, {
              backendUrl: webmToAvifBackend.value
            })
            extension = 'avif'
          } catch (convertError) {
            console.warn('WebM 转换失败，已跳过该贴纸：', convertError)
            continue
          }
        }

        // 确定 MIME 类型
        let mimeType = blob.type
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (extension === 'webp') mimeType = 'image/webp'
          else if (extension === 'png') mimeType = 'image/png'
          else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg'
          else if (extension === 'gif') mimeType = 'image/gif'
          else if (extension === 'avif') mimeType = 'image/avif'
          else mimeType = 'image/webp' // default for stickers
        }

        // 创建 File 对象
        const filename = `${sticker.emoji || 'sticker'}_${i + 1}.${extension}`
        const file = new File([blob], filename, { type: mimeType })

        // 上传到托管服务
        progress.value.message = `上传贴纸 ${i + 1}/${total} 到 ${uploadService.value}...`
        const uploadUrl = await service.uploadFile(file, () => {
          // console.log(`Upload progress: ${percent}%`)
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
        // message.warning(`贴纸 ${i + 1} 上传失败，已跳过`)
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
  <a-modal
    v-model:open="isOpen"
    title="导入 Telegram 贴纸包"
    :width="700"
    :footer="null"
    @cancel="close"
    :mask-closable="!isProcessing"
    :keyboard="!isProcessing"
    :closable="!isProcessing"
  >
    <div class="space-y-4">
      <!-- 错误信息 -->
      <a-alert v-if="errorMessage" :message="errorMessage" type="error" show-icon class="mb-4" />

      <!-- Bot Token 设置 -->
      <div
        class="p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
      >
        <h4 class="font-medium mb-2 flex items-center gap-2 dark:text-gray-200">
          Bot Token 设置
          <a-tooltip title="访问 Telegram API 需要 Bot Token，请向 @BotFather 申请">
            <QuestionCircleOutlined class="text-gray-400" />
          </a-tooltip>
        </h4>
        <div class="flex gap-2">
          <a-input-password
            v-model:value="telegramBotToken"
            placeholder="输入 Telegram Bot Token"
          />
          <a-button @click="saveBotToken" :disabled="!telegramBotToken">
            <template #icon><SaveOutlined /></template>
            保存
          </a-button>
        </div>
      </div>

      <!-- 上传服务选择 -->
      <div
        class="p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
      >
        <h4 class="font-medium mb-2 flex items-center gap-2 dark:text-gray-200">
          选择上传服务
          <a-tooltip title="贴纸将直接上传到选定的图床服务">
            <QuestionCircleOutlined class="text-gray-400" />
          </a-tooltip>
        </h4>
        <a-radio-group v-model:value="uploadService" button-style="solid">
          <a-radio-button value="linux.do">linux.do</a-radio-button>
          <a-radio-button value="idcflare.com">idcflare.com</a-radio-button>
          <a-radio-button value="imgbed">imgbed</a-radio-button>
        </a-radio-group>
      </div>

      <!-- 贴纸包输入 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          贴纸包链接或名称
        </label>
        <div class="flex gap-2">
          <a-input
            v-model:value="telegramInput"
            placeholder="例如：https://t.me/addstickers/xxx 或 xxx"
            @pressEnter="previewStickerSet"
            :disabled="isProcessing"
          />
          <a-button
            type="primary"
            @click="previewStickerSet"
            :loading="isProcessing && !stickerSetInfo"
            :disabled="!telegramInput || isProcessing"
          >
            <template #icon><SearchOutlined /></template>
            预览
          </a-button>
        </div>
      </div>

      <!-- 进度显示 -->
      <div v-if="isProcessing" class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
        <div class="flex justify-between mb-2 text-sm">
          <span class="text-blue-700 dark:text-blue-300">{{ progress.message }}</span>
          <span v-if="progress.total > 0" class="text-blue-700 dark:text-blue-300">
            {{ progress.processed }}/{{ progress.total }}
          </span>
        </div>
        <a-progress
          :percent="
            progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
          "
          status="active"
          :stroke-color="{ from: '#108ee9', to: '#87d068' }"
        />
      </div>

      <!-- 贴纸包预览与导入设置 -->
      <div v-if="stickerSetInfo" class="mt-4 border-t pt-4 dark:border-gray-700">
        <div
          class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800"
        >
          <div class="flex items-start gap-3">
            <FileImageOutlined class="text-2xl text-green-600 dark:text-green-400 mt-1" />
            <div>
              <h4 class="font-bold text-lg text-green-900 dark:text-green-100">
                {{ stickerSetInfo.title }}
              </h4>
              <p class="text-green-800 dark:text-green-200 text-sm">
                包含 {{ stickerSetInfo.stickers.length }} 个贴纸
                <span
                  v-if="stickerSetInfo.is_animated"
                  class="ml-2 px-1.5 py-0.5 bg-green-200 dark:bg-green-800 rounded text-xs"
                >
                  动画
                </span>
                <span
                  v-if="stickerSetInfo.is_video"
                  class="ml-2 px-1.5 py-0.5 bg-green-200 dark:bg-green-800 rounded text-xs"
                >
                  视频
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- 导入模式 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            导入方式
          </label>
          <a-radio-group v-model:value="importMode">
            <a-radio value="new">新建分组</a-radio>
            <a-radio value="update">更新/添加到已有分组</a-radio>
          </a-radio-group>
        </div>

        <!-- 新建分组设置 -->
        <div v-if="importMode === 'new'" class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              分组名称
            </label>
            <a-input v-model:value="newGroupName" placeholder="输入分组名称" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              图标
            </label>
            <a-input v-model:value="newGroupIcon" placeholder="输入 Emoji" />
          </div>
        </div>

        <!-- 更新分组设置 -->
        <div v-if="importMode === 'update'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            选择目标分组
          </label>
          <a-select
            v-model:value="selectedGroupId"
            class="w-full"
            placeholder="请选择分组"
            show-search
            option-filter-prop="label"
          >
            <a-select-option
              v-for="group in availableGroups"
              :key="group.id"
              :value="group.id"
              :label="group.name"
            >
              <span role="img" :aria-label="group.name" class="mr-2">{{ group.icon }}</span>
              {{ group.name }} ({{ group.emojis.length }})
            </a-select-option>
          </a-select>
        </div>

        <!-- 底部按钮 -->
        <div class="flex justify-end gap-3 mt-6">
          <a-button @click="close" :disabled="isProcessing">取消</a-button>
          <a-button
            type="primary"
            @click="doImport"
            :loading="isProcessing"
            :disabled="
              !stickerSetInfo ||
              (importMode === 'new' && !newGroupName.trim()) ||
              (importMode === 'update' && !selectedGroupId)
            "
          >
            <template #icon><CloudUploadOutlined /></template>
            开始导入
          </a-button>
        </div>
      </div>

      <div
        v-else
        class="text-xs text-gray-500 dark:text-gray-400 mt-4 bg-gray-50 dark:bg-gray-800 p-3 rounded"
      >
        <p class="font-medium mb-1">💡 提示：</p>
        <ul class="list-disc pl-4 space-y-1">
          <li>导入将会把贴纸直接上传到选定的图床服务。</li>
          <li>支持静态图片贴纸。视频贴纸 (WebM) 需配置转 AVIF 后端，否则会被跳过。</li>
          <li>如果遇到 "Too Many Requests" 错误，请稍后重试。</li>
        </ul>
      </div>
    </div>
  </a-modal>
</template>

<style scoped src="./TelegramStickerModal.css" />
