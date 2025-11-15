<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { useEmojiStore } from '../../stores/emojiStore'

const emojiStore = useEmojiStore()

// State
const stickerPackUrl = ref('')
const groupName = ref('')
const isImporting = ref(false)

// Results
const importResults = ref<
  Array<{
    id: string
    groupName: string
    groupId?: string
    success: boolean
    count?: number
    error?: string
  }>
>([])

// Messages
const message = ref({ text: '', type: 'success' as 'success' | 'error' })

onMounted(async () => {
  await emojiStore.loadData()
})

// Helper function to extract sticker pack name from URL
const extractPackName = (url: string): string | null => {
  // Support formats:
  // https://t.me/addstickers/PackName
  // https://telegram.me/addstickers/PackName
  // t.me/addstickers/PackName
  const match = url.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/addstickers\/([^/?#]+)/)
  return match ? match[1] : null
}

// Parse Telegram sticker pack
const parseTelegramStickerPack = async (
  packName: string
): Promise<Array<{ name: string; url: string }>> => {
  try {
    // Use Telegram's public API to get sticker set info
    // Note: This requires a proxy or CORS-enabled endpoint
    const apiUrl = `https://api.telegram.org/bot/getStickerSet?name=${packName}`

    // For development, we'll use a proxy service or expect users to have a bot token
    // In production, you might want to set up your own proxy server
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`无法获取贴纸包信息: HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.ok || !data.result || !data.result.stickers) {
      throw new Error('贴纸包数据格式不正确')
    }

    const stickers = data.result.stickers
    const emojis: Array<{ name: string; url: string }> = []

    for (let i = 0; i < stickers.length; i++) {
      const sticker = stickers[i]
      // Get the file_id and construct download URL
      // Note: Telegram file URLs require authentication
      const fileId = sticker.file_id
      const emoji = sticker.emoji || '🖼️'

      // For WebP stickers, we'll use the thumbnail or file_id
      // In a real implementation, you'd need to:
      // 1. Get file path using getFile API
      // 2. Download using https://api.telegram.org/file/bot<token>/<file_path>
      const name = `${emoji}_${i + 1}`

      // This is a placeholder - in production, you'd need proper file handling
      emojis.push({
        name,
        url: `tg://sticker?file_id=${fileId}` // Placeholder URL
      })
    }

    return emojis
  } catch (error) {
    console.error('Error parsing Telegram sticker pack:', error)
    throw error
  }
}

// Alternative method: Parse from exported Telegram sticker pack data
const parseExportedStickerData = (data: any): Array<{ name: string; url: string }> => {
  const emojis: Array<{ name: string; url: string }> = []

  try {
    // Handle exported sticker pack format
    if (Array.isArray(data.stickers)) {
      for (let i = 0; i < data.stickers.length; i++) {
        const sticker = data.stickers[i]
        const name = sticker.emoji || sticker.name || `sticker_${i + 1}`
        const url = sticker.url || sticker.file || sticker.webp

        if (url) {
          emojis.push({ name, url })
        }
      }
    }
  } catch (error) {
    console.error('Error parsing exported sticker data:', error)
  }

  return emojis
}

const importFromUrl = async () => {
  if (!stickerPackUrl.value.trim()) return

  isImporting.value = true
  const resultId = Date.now().toString()

  try {
    const packName = extractPackName(stickerPackUrl.value.trim())

    if (!packName) {
      throw new Error('无效的 Telegram 贴纸包链接格式')
    }

    showMessage('提示：Telegram API 需要认证。请使用导出的 JSON 格式代替。', 'error')

    // For now, we'll provide instructions instead of direct import
    throw new Error('由于 Telegram API 限制，请使用第三方工具导出贴纸包为 JSON 格式后导入')

    // Uncomment when bot token is available:
    // const emojis = await parseTelegramStickerPack(packName)
    // ... rest of import logic
  } catch (error) {
    console.error('Import from Telegram URL failed:', error)
    const errorMessage = error instanceof Error ? error.message : '导入失败'

    importResults.value.unshift({
      id: resultId,
      groupName: groupName.value.trim() || 'Telegram 贴纸包',
      success: false,
      error: errorMessage
    })

    showMessage(`导入失败：${errorMessage}`, 'error')
  } finally {
    isImporting.value = false
  }
}

// Import from exported JSON
const jsonInput = ref('')
const isImportingJson = ref(false)

const importFromJson = async () => {
  if (!jsonInput.value.trim()) return

  isImportingJson.value = true
  const resultId = Date.now().toString()

  try {
    const data = JSON.parse(jsonInput.value.trim())
    const emojis = parseExportedStickerData(data)

    if (emojis.length === 0) {
      throw new Error('未找到有效的贴纸数据')
    }

    const targetGroupName = groupName.value.trim() || data.name || 'Telegram 贴纸包'
    const group = await emojiStore.createGroup(targetGroupName, '✈️')

    for (const emoji of emojis) {
      emojiStore.addEmojiWithoutSave(group.id, {
        ...emoji,
        packet: Date.now() + Math.floor(Math.random() * 1000)
      })
    }

    await emojiStore.saveData()

    importResults.value.unshift({
      id: resultId,
      groupName: targetGroupName,
      groupId: group.id,
      success: true,
      count: emojis.length
    })

    showMessage(`成功导入 ${emojis.length} 个贴纸到分组 "${targetGroupName}"`, 'success')

    // Clear inputs
    jsonInput.value = ''
    groupName.value = ''
  } catch (error) {
    console.error('Import from JSON failed:', error)
    const errorMessage = error instanceof Error ? error.message : '导入失败'

    importResults.value.unshift({
      id: resultId,
      groupName: groupName.value.trim() || 'Telegram 贴纸包',
      success: false,
      error: errorMessage
    })

    showMessage(`JSON 格式错误：${errorMessage}`, 'error')
  } finally {
    isImportingJson.value = false
  }
}

const viewGroup = (groupId?: string) => {
  if (groupId) {
    window.open(`/options.html#groups=${groupId}`, '_blank')
  }
}

const clearResults = () => {
  importResults.value = []
}

const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value.text = ''
  }, 5000)
}

const fillExampleJson = () => {
  jsonInput.value = JSON.stringify(
    {
      name: '示例贴纸包',
      stickers: [
        {
          emoji: '😀',
          name: 'happy',
          url: 'https://example.com/sticker1.webp'
        },
        {
          emoji: '😂',
          name: 'laugh',
          url: 'https://example.com/sticker2.webp'
        },
        {
          emoji: '❤️',
          name: 'love',
          url: 'https://example.com/sticker3.webp'
        }
      ]
    },
    null,
    2
  )
}
</script>

<template>
  <div class="space-y-6 dark:text-white dark:bg-gray-900">
    <!-- Instructions -->
    <div
      class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
    >
      <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">使用说明</h3>
      <div class="text-sm text-blue-800 dark:text-blue-200 space-y-2">
        <p>由于 Telegram API 限制，目前支持以下两种导入方式：</p>
        <ol class="list-decimal ml-5 space-y-1">
          <li>
            使用第三方工具（如
            <a
              href="https://github.com/zevlg/telega.el"
              target="_blank"
              class="underline hover:text-blue-600"
            >
              Telegram 导出工具
            </a>
            ）导出贴纸包为 JSON 格式
          </li>
          <li>手动创建符合格式的 JSON 配置文件</li>
        </ol>
        <p class="text-xs mt-2">
          JSON 格式:
          <code class="bg-blue-100 dark:bg-blue-800 px-1 rounded">
            { "name": "贴纸包名", "stickers": [{ "emoji": "😀", "name": "名称", "url": "图片链接" }]
            }
          </code>
        </p>
      </div>
    </div>

    <!-- Import Methods -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- URL Import (Currently disabled) -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 opacity-60"
      >
        <h3 class="text-lg font-semibold mb-2">从链接导入（暂不可用）</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          输入 Telegram 贴纸包链接
          <br />
          <span class="text-xs text-red-500">注意：需要配置 Bot Token 才能使用此功能</span>
        </p>

        <div class="space-y-4">
          <div>
            <label
              for="sticker-url"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              贴纸包链接
            </label>
            <input
              id="sticker-url"
              v-model="stickerPackUrl"
              type="url"
              disabled
              title="Telegram 贴纸包链接 (需要 Bot Token)"
              class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              placeholder="https://t.me/addstickers/PackName"
            />
          </div>

          <a-button
            @click="importFromUrl"
            disabled
            class="w-full px-4 py-2 text-sm bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
            title="此功能需要配置 Telegram Bot Token"
          >
            从链接导入（暂不可用）
          </a-button>
        </div>
      </div>

      <!-- JSON Import -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold mb-2">从 JSON 导入</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          粘贴导出的 Telegram 贴纸包 JSON 数据
          <br />
          <span class="text-xs text-gray-500 dark:text-gray-500">
            支持包含 name 和 stickers 数组的标准格式
          </span>
        </p>

        <div class="space-y-4">
          <div>
            <label
              for="json-input"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              JSON 数据
            </label>
            <textarea
              id="json-input"
              v-model="jsonInput"
              rows="8"
              title="Telegram 贴纸包 JSON 数据"
              class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs dark:bg-gray-700 dark:text-white"
              placeholder='{ "name": "贴纸包名", "stickers": [{ "emoji": "😀", "name": "happy", "url": "https://..." }] }'
            ></textarea>
          </div>

          <div class="flex gap-2">
            <a-button
              @click="fillExampleJson"
              type="default"
              class="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="填充示例 JSON 格式"
            >
              填充示例
            </a-button>
          </div>

          <div>
            <label
              for="group-name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              分组名称（可选）
            </label>
            <input
              id="group-name"
              v-model="groupName"
              type="text"
              title="导入分组名称，留空则使用 JSON 中的名称"
              class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              placeholder="留空则使用 JSON 中的名称"
            />
          </div>

          <a-button
            @click="importFromJson"
            :disabled="!jsonInput.trim() || isImportingJson"
            type="primary"
            class="w-full px-4 py-2 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            title="从 JSON 数据导入 Telegram 贴纸"
          >
            {{ isImportingJson ? '导入中...' : '从 JSON 导入' }}
          </a-button>
        </div>
      </div>
    </div>

    <!-- Import Results -->
    <div
      v-if="importResults.length > 0"
      class="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6"
    >
      <h3 class="text-lg font-semibold mb-4">导入结果</h3>
      <div class="space-y-3">
        <div
          v-for="result in importResults"
          :key="result.id"
          class="flex items-center justify-between p-3 border rounded-lg"
          :class="{
            'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20':
              result.success,
            'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20': !result.success
          }"
        >
          <div class="flex items-center gap-3">
            <span
              class="w-6 h-6 flex items-center justify-center rounded-full text-sm"
              :class="{
                'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200': result.success,
                'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-200': !result.success
              }"
            >
              {{ result.success ? '✓' : '✕' }}
            </span>
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ result.groupName }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ result.success ? `成功导入 ${result.count} 个贴纸` : result.error }}
              </p>
            </div>
          </div>

          <a-button
            v-if="result.success"
            @click="viewGroup(result.groupId)"
            type="link"
            class="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            :title="'查看 ' + result.groupName + ' 分组'"
          >
            查看分组
          </a-button>
        </div>
      </div>

      <div class="mt-4 flex justify-end">
        <a-button
          @click="clearResults"
          type="default"
          class="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          title="清除所有导入结果"
        >
          清除结果
        </a-button>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div
      v-if="message.text"
      class="fixed top-4 right-4 max-w-sm w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-50"
      :class="{
        'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20':
          message.type === 'success',
        'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20': message.type === 'error'
      }"
    >
      <div class="p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-sm"
              :class="{
                'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200':
                  message.type === 'success',
                'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-200':
                  message.type === 'error'
              }"
            >
              {{ message.type === 'success' ? '✓' : '✕' }}
            </span>
          </div>
          <div class="ml-3 flex-1">
            <p
              class="text-sm font-medium"
              :class="{
                'text-green-800 dark:text-green-200': message.type === 'success',
                'text-red-800 dark:text-red-200': message.type === 'error'
              }"
            >
              {{ message.text }}
            </p>
          </div>
          <div class="ml-auto pl-3">
            <a-button
              @click="message.text = ''"
              type="text"
              class="inline-flex text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              title="关闭消息"
            >
              <span class="sr-only">关闭</span>
              ✕
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
