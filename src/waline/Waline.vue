<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { logger } from '../config/buildFlags'
import { useEmojiStore } from '../stores/emojiStore'

const emojiStore = useEmojiStore()

// State
const urlInput = ref('')
const urlGroupName = ref('')
const jsonInput = ref('')
const jsonGroupName = ref('')
const isImportingUrl = ref(false)
const isImportingJson = ref(false)
const isImportingSource = ref('')

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

// Popular sources
const popularSources = [
  {
    name: 'QQ 表情',
    icon: '🐧',
    description: 'QQ 经典表情包',
    url: 'https://raw.githubusercontent.com/walinejs/emojis/main/qq/info.json'
  },
  {
    name: '微信表情',
    icon: '💬',
    description: '微信默认表情',
    url: 'https://raw.githubusercontent.com/walinejs/emojis/main/weibo/info.json'
  },
  {
    name: 'Bilibili',
    icon: '📺',
    description: 'B站小电视表情',
    url: 'https://raw.githubusercontent.com/walinejs/emojis/main/bilibili/info.json'
  },
  {
    name: 'Tieba',
    icon: '🗣️',
    description: '百度贴吧表情',
    url: 'https://raw.githubusercontent.com/walinejs/emojis/main/tieba/info.json'
  },
  {
    name: 'hoyoverse-hi3',
    icon: '🌟',
    description: '崩坏三表情包',
    url: 'https://raw.githubusercontent.com/walinejs/emojis/main/hoyoverse-hi3/info.json'
  },
  {
    name: 'coolapk',
    icon: '😊',
    description: 'coolapk 表情包',
    url: 'https://raw.githubusercontent.com/walinejs/emojis/main/coolapk/info.json'
  }
]

onMounted(async () => {
  await emojiStore.loadData()
})

// Methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseWalineConfig = (data: any): Array<{ name: string; url: string }> => {
  const emojis: Array<{ name: string; url: string }> = []

  try {
    // Handle different Waline emoji formats
    if (typeof data === 'object' && data !== null) {
      // Format 0: Weibo style with items array and prefix
      // { "name": "Weibo", "prefix": "weibo_", "type": "png", "icon": "doge", "items": [...] }
      if (Array.isArray(data.items) && data.prefix && data.type) {
        const prefix = data.prefix || ''
        const type = data.type || 'png'
        const baseUrl = data.baseUrl || 'https://cdn.jsdelivr.net/gh/walinejs/emojis/'

        for (const item of data.items) {
          if (typeof item === 'string') {
            const name = item
            const url = `${baseUrl}${data.name?.toLowerCase() || 'weibo'}/${prefix}${item}.${type}`
            emojis.push({ name, url })
          }
        }
      }

      // Format 1: { "category": { "type": "image", "container": [...] } }
      else {
        for (const categoryKey in data) {
          const category = data[categoryKey]

          if (category && typeof category === 'object') {
            // Check for container array
            if (Array.isArray(category.container)) {
              for (const item of category.container) {
                if (item && typeof item === 'object') {
                  const name = item.text || item.name || item.title || `emoji-${emojis.length}`
                  const url = item.src || item.url || item.icon

                  if (url && typeof url === 'string') {
                    emojis.push({ name, url })
                  }
                }
              }
            }
            // Check for direct emoji objects
            else if (category.src || category.url) {
              const name = category.text || category.name || `emoji-${emojis.length}`
              const url = category.src || category.url
              emojis.push({ name, url })
            }
            // Check for nested objects
            else {
              for (const itemKey in category) {
                const item = category[itemKey]
                if (item && typeof item === 'object' && (item.src || item.url)) {
                  const name = item.text || item.name || itemKey
                  const url = item.src || item.url
                  emojis.push({ name, url })
                }
              }
            }
          }
        }
      }

      // Format 2: Direct array of emoji objects
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && typeof item === 'object') {
            const name = item.text || item.name || item.title || `emoji-${emojis.length}`
            const url = item.src || item.url || item.icon

            if (url && typeof url === 'string') {
              emojis.push({ name, url })
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error parsing Waline config:', error)
  }

  return emojis
}

const importFromUrl = async () => {
  if (!urlInput.value.trim()) return

  isImportingUrl.value = true
  const resultId = Date.now().toString()

  try {
    const response = await fetch(urlInput.value.trim())
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const emojis = parseWalineConfig(data)

    if (emojis.length === 0) {
      throw new Error('未找到有效的表情数据')
    }

    const groupName = urlGroupName.value.trim() || 'Waline 表情包'
    const group = await emojiStore.createGroup(groupName, '🌐')

    for (const emoji of emojis) {
      emojiStore.addEmojiWithoutSave(group.id, {
        ...emoji,
        packet: Date.now() + Math.floor(Math.random() * 1000)
      })
    }

    await emojiStore.saveData()

    importResults.value.unshift({
      id: resultId,
      groupName,
      groupId: group.id,
      success: true,
      count: emojis.length
    })

    showMessage(`成功导入 ${emojis.length} 个表情到分组 "${groupName}"`, 'success')

    // Clear inputs
    urlInput.value = ''
    urlGroupName.value = ''
  } catch (error) {
    logger.error('Import from URL failed:', error)
    const errorMessage = error instanceof Error ? error.message : '导入失败'

    importResults.value.unshift({
      id: resultId,
      groupName: urlGroupName.value.trim() || 'Waline 表情包',
      success: false,
      error: errorMessage
    })

    showMessage(`导入失败: ${errorMessage}`, 'error')
  } finally {
    isImportingUrl.value = false
  }
}

const importFromJson = async () => {
  if (!jsonInput.value.trim()) return

  isImportingJson.value = true
  const resultId = Date.now().toString()

  try {
    const data = JSON.parse(jsonInput.value.trim())
    const emojis = parseWalineConfig(data)

    if (emojis.length === 0) {
      throw new Error('未找到有效的表情数据')
    }

    const groupName = jsonGroupName.value.trim() || 'Waline 表情包'
    const group = await emojiStore.createGroup(groupName, '📝')

    for (const emoji of emojis) {
      emojiStore.addEmojiWithoutSave(group.id, {
        ...emoji,
        packet: Date.now() + Math.floor(Math.random() * 1000)
      })
    }

    await emojiStore.saveData()

    importResults.value.unshift({
      id: resultId,
      groupName,
      groupId: group.id,
      success: true,
      count: emojis.length
    })

    showMessage(`成功导入 ${emojis.length} 个表情到分组 "${groupName}"`, 'success')

    // Clear inputs
    jsonInput.value = ''
    jsonGroupName.value = ''
  } catch (error) {
    logger.error('Import from JSON failed:', error)
    const errorMessage = error instanceof Error ? error.message : '导入失败'

    importResults.value.unshift({
      id: resultId,
      groupName: jsonGroupName.value.trim() || 'Waline 表情包',
      success: false,
      error: errorMessage
    })

    showMessage(`JSON 格式错误: ${errorMessage}`, 'error')
  } finally {
    isImportingJson.value = false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const importFromSource = async (source: any) => {
  isImportingSource.value = source.name
  const resultId = Date.now().toString()

  try {
    const response = await fetch(source.url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const emojis = parseWalineConfig(data)

    if (emojis.length === 0) {
      throw new Error('未找到有效的表情数据')
    }

    const group = await emojiStore.createGroup(source.name, source.icon)

    for (const emoji of emojis) {
      emojiStore.addEmojiWithoutSave(group.id, {
        ...emoji,
        packet: Date.now() + Math.floor(Math.random() * 1000)
      })
    }

    await emojiStore.saveData()

    importResults.value.unshift({
      id: resultId,
      groupName: source.name,
      groupId: group.id,
      success: true,
      count: emojis.length
    })

    showMessage(`成功导入 ${source.name} (${emojis.length} 个表情)`, 'success')
  } catch (error) {
    logger.error('Import from source failed:', error)
    const errorMessage = error instanceof Error ? error.message : '导入失败'

    importResults.value.unshift({
      id: resultId,
      groupName: source.name,
      success: false,
      error: errorMessage
    })

    showMessage(`导入 ${source.name} 失败: ${errorMessage}`, 'error')
  } finally {
    isImportingSource.value = ''
  }
}

const viewGroup = (groupId?: string) => {
  if (groupId) {
    // Open options page with the specific group
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
  }, 3000)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Waline 表情导入</h1>
            <p class="text-sm text-gray-600">从 GitHub 仓库批量导入 Waline 风格的表情包</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Import Methods -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- URL Import -->
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">从 URL 导入</h2>
          <p class="text-sm text-gray-600 mb-4">
            输入 Waline 表情配置的 JSON URL 或 GitHub raw 文件链接
            <br />
            <span class="text-xs text-gray-500">支持标准 Waline 格式和 Weibo 风格格式</span>
          </p>

          <div class="space-y-4">
            <div>
              <label for="url-input" class="block text-sm font-medium text-gray-700">
                表情配置 URL
              </label>
              <input
                id="url-input"
                v-model="urlInput"
                type="url"
                class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="https://raw.githubusercontent.com/user/repo/main/emoji.json"
              />
            </div>

            <div>
              <label for="url-group-name" class="block text-sm font-medium text-gray-700">
                分组名称
              </label>
              <input
                id="url-group-name"
                v-model="urlGroupName"
                type="text"
                class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Waline 表情包"
              />
            </div>

            <button
              @click="importFromUrl"
              :disabled="!urlInput.trim() || isImportingUrl"
              class="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {{ isImportingUrl ? '导入中...' : '从 URL 导入' }}
            </button>
          </div>
        </div>

        <!-- JSON Text Import -->
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">从 JSON 文本导入</h2>
          <p class="text-sm text-gray-600 mb-4">
            直接粘贴 Waline 表情配置的 JSON 内容
            <br />
            <span class="text-xs text-gray-500">
              支持标准 Waline 格式和 Weibo 风格格式 (包含 name, prefix, type, items 的配置)
            </span>
          </p>

          <div class="space-y-4">
            <div>
              <label for="json-input" class="block text-sm font-medium text-gray-700">
                JSON 配置
              </label>
              <textarea
                id="json-input"
                v-model="jsonInput"
                rows="8"
                class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                placeholder='示例格式1: { "表情包名": { "type": "image", "container": [{ "icon": "😀", "text": "表情名", "src": "图片链接" }] } }
示例格式2: { "name": "Weibo", "prefix": "weibo_", "type": "png", "items": ["smile", "lovely"] }'
              ></textarea>
            </div>

            <div>
              <label for="json-group-name" class="block text-sm font-medium text-gray-700">
                分组名称
              </label>
              <input
                id="json-group-name"
                v-model="jsonGroupName"
                type="text"
                class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Waline 表情包"
              />
            </div>

            <button
              @click="importFromJson"
              :disabled="!jsonInput.trim() || isImportingJson"
              class="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {{ isImportingJson ? '导入中...' : '从 JSON 导入' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Common Waline Emoji Sources -->
      <div class="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">常用 Waline 表情源</h2>
        <p class="text-sm text-gray-600 mb-6">点击下方链接快速导入常用的 Waline 表情包</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="source in popularSources"
            :key="source.name"
            class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl">{{ source.icon }}</span>
              <div>
                <h3 class="font-medium text-gray-900">{{ source.name }}</h3>
                <p class="text-xs text-gray-500">{{ source.description }}</p>
              </div>
            </div>

            <button
              @click="importFromSource(source)"
              :disabled="isImportingSource === source.name"
              class="w-full mt-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            >
              {{ isImportingSource === source.name ? '导入中...' : '快速导入' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Import Results -->
      <div v-if="importResults.length > 0" class="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">导入结果</h2>

        <div class="space-y-3">
          <div
            v-for="result in importResults"
            :key="result.id"
            class="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
            :class="{
              'border-green-200 bg-green-50': result.success,
              'border-red-200 bg-red-50': !result.success
            }"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-6 h-6 flex items-center justify-center rounded-full text-sm"
                :class="{
                  'bg-green-100 text-green-600': result.success,
                  'bg-red-100 text-red-600': !result.success
                }"
              >
                {{ result.success ? '✓' : '✕' }}
              </span>
              <div>
                <p class="font-medium text-gray-900">{{ result.groupName }}</p>
                <p class="text-sm text-gray-600">
                  {{ result.success ? `成功导入 ${result.count} 个表情` : result.error }}
                </p>
              </div>
            </div>

            <button
              v-if="result.success"
              @click="viewGroup(result.groupId)"
              class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              查看分组
            </button>
          </div>
        </div>

        <div class="mt-4 flex justify-end">
          <button
            @click="clearResults"
            class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
          >
            清除结果
          </button>
        </div>
      </div>
    </main>

    <!-- Success/Error Messages -->
    <div
      v-if="message.text"
      class="fixed top-4 right-4 max-w-sm w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50"
      :class="{
        'border-green-200 bg-green-50': message.type === 'success',
        'border-red-200 bg-red-50': message.type === 'error'
      }"
    >
      <div class="p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-sm"
              :class="{
                'bg-green-100 text-green-600': message.type === 'success',
                'bg-red-100 text-red-600': message.type === 'error'
              }"
            >
              {{ message.type === 'success' ? '✓' : '✕' }}
            </span>
          </div>
          <div class="ml-3">
            <p
              class="text-sm font-medium"
              :class="{
                'text-green-800': message.type === 'success',
                'text-red-800': message.type === 'error'
              }"
            >
              {{ message.text }}
            </p>
          </div>
          <div class="ml-auto pl-3">
            <button
              @click="message.text = ''"
              class="inline-flex text-gray-400 hover:text-gray-600"
            >
              <span class="sr-only">关闭</span>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
