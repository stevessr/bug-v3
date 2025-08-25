<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'

interface Props {
  activeTab: string
}

const props = defineProps<Props>()

// Types
interface Emoji {
  id: string
  name: string
  url: string
  groupId: string
}

interface RenamingResult {
  emojiId: string
  emoji: Emoji
  suggestions: string[]
  selectedSuggestion: number | null
}

// State
const selectedAIProvider = ref('gemini')
const testingAI = ref(false)
const processing = ref(false)
const selectedEmojis = ref<Set<string>>(new Set())

// AI Configurations
const aiConfigs = ref({
  gemini: {
    apiKey: '',
    model: 'gemini-1.5-flash'
  },
  openai: {
    apiKey: '',
    model: 'gpt-4o'
  },
  claude: {
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022'
  },
  openaiCompatible: {
    endpoint: '',
    apiKey: '',
    model: ''
  }
})

const browserAIStatus = ref({
  chrome: false,
  edge: false
})

// Processing parameters
const namingPrompt = ref(
  '分析这个表情包图像，为它提供 3-5 个简洁、准确的中文名称建议，名称应该描述图像中的动作、表情或情绪。每个建议用换行分隔。'
)
const namingStyle = ref('descriptive')
const suggestionCount = ref(3)

// Processing status
const processingStatus = ref({
  current: 0,
  total: 0,
  currentEmoji: '',
  message: ''
})

// Results
const renamingResults = ref<RenamingResult[]>([])

// Mock data for emojis
const availableEmojis = ref<Emoji[]>([
  { id: '1', name: '开心', url: 'https://picsum.photos/48/48?random=1', groupId: 'group1' },
  { id: '2', name: '哭泣', url: 'https://picsum.photos/48/48?random=2', groupId: 'group1' },
  { id: '3', name: '生气', url: 'https://picsum.photos/48/48?random=3', groupId: 'group1' },
  { id: '4', name: '惊讶', url: 'https://picsum.photos/48/48?random=4', groupId: 'group1' },
  { id: '5', name: '疑问', url: 'https://picsum.photos/48/48?random=5', groupId: 'group1' },
  { id: '6', name: '无语', url: 'https://picsum.photos/48/48?random=6', groupId: 'group1' },
  { id: '7', name: '尴尬', url: 'https://picsum.photos/48/48?random=7', groupId: 'group1' },
  { id: '8', name: '得意', url: 'https://picsum.photos/48/48?random=8', groupId: 'group1' }
])

// AI Providers configuration
const aiProviders = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔍',
    description: 'Vision API 图像分析',
    supportsDirectUrl: true
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    icon: '🤖',
    description: '智能图像理解',
    supportsDirectUrl: true
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '🎭',
    description: '高级图像理解',
    supportsDirectUrl: false
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI 兼容 API',
    icon: '🔗',
    description: '自定义端点',
    supportsDirectUrl: true
  },
  {
    id: 'chrome-ai',
    name: 'Chrome AI',
    icon: '🌐',
    description: '浏览器本地处理',
    supportsDirectUrl: false
  },
  {
    id: 'edge-ai',
    name: 'Edge AI',
    icon: '🔷',
    description: 'Edge 写作助手',
    supportsDirectUrl: false
  }
]

// Computed
const isAIConfigured = computed(() => {
  switch (selectedAIProvider.value) {
    case 'gemini':
      return aiConfigs.value.gemini.apiKey
    case 'openai':
      return aiConfigs.value.openai.apiKey
    case 'claude':
      return aiConfigs.value.claude.apiKey
    case 'openai-compatible':
      return (
        aiConfigs.value.openaiCompatible.endpoint &&
        aiConfigs.value.openaiCompatible.apiKey &&
        aiConfigs.value.openaiCompatible.model
      )
    case 'chrome-ai':
      return browserAIStatus.value.chrome
    case 'edge-ai':
      return browserAIStatus.value.edge
    default:
      return false
  }
})

// Methods
const selectAIProvider = (providerId: string) => {
  selectedAIProvider.value = providerId
}

const testAIConnection = async () => {
  if (!isAIConfigured.value) {
    message.error('请先完成配置')
    return
  }

  testingAI.value = true
  try {
    // Simulate API test
    await delay(1500)
    message.success('AI 连接测试成功！')
  } catch (error) {
    message.error('连接测试失败')
  } finally {
    testingAI.value = false
  }
}

const toggleEmojiSelection = (emoji: Emoji) => {
  if (selectedEmojis.value.has(emoji.id)) {
    selectedEmojis.value.delete(emoji.id)
  } else {
    selectedEmojis.value.add(emoji.id)
  }
}

const selectAllEmojis = () => {
  availableEmojis.value.forEach(emoji => selectedEmojis.value.add(emoji.id))
}

const clearSelection = () => {
  selectedEmojis.value.clear()
}

const cacheSelectedEmojis = async () => {
  const count = selectedEmojis.value.size
  message.loading('正在缓存表情...', 1)
  await delay(1000)
  message.success(`已缓存 ${count} 个表情`)
}

const startBatchRenaming = async () => {
  if (selectedEmojis.value.size === 0) {
    message.error('请先选择要重命名的表情')
    return
  }

  processing.value = true
  renamingResults.value = []

  const selectedEmojiList = availableEmojis.value.filter(emoji =>
    selectedEmojis.value.has(emoji.id)
  )

  processingStatus.value = {
    current: 0,
    total: selectedEmojiList.length,
    currentEmoji: '',
    message: '开始处理...'
  }

  try {
    for (let i = 0; i < selectedEmojiList.length; i++) {
      const emoji = selectedEmojiList[i]

      processingStatus.value = {
        current: i + 1,
        total: selectedEmojiList.length,
        currentEmoji: emoji.name,
        message: `正在分析表情: ${emoji.name}`
      }

      // Simulate AI processing
      await delay(2000)

      // Generate mock suggestions
      const suggestions = generateMockSuggestions(emoji.name)

      renamingResults.value.push({
        emojiId: emoji.id,
        emoji,
        suggestions,
        selectedSuggestion: null
      })
    }

    processingStatus.value.message = '处理完成！'
    message.success(`成功处理了 ${selectedEmojiList.length} 个表情`)
  } catch (error) {
    message.error('处理过程中出现错误')
  } finally {
    processing.value = false
  }
}

const generateMockSuggestions = (originalName: string): string[] => {
  const suggestions = [
    `${originalName}_智能`,
    `${originalName}_表情`,
    `${originalName}_萌萌`,
    `AI_${originalName}`,
    `新_${originalName}`
  ]
  return suggestions.slice(0, suggestionCount.value)
}

const selectSuggestion = (emojiId: string, suggestionIndex: number) => {
  const result = renamingResults.value.find(r => r.emojiId === emojiId)
  if (result) {
    result.selectedSuggestion = suggestionIndex
  }
}

const applyRename = (result: RenamingResult) => {
  if (result.selectedSuggestion === null) return

  const newName = result.suggestions[result.selectedSuggestion]
  // Here you would update the actual emoji name in your store
  message.success(`已将 "${result.emoji.name}" 重命名为 "${newName}"`)

  // Remove from results
  const index = renamingResults.value.indexOf(result)
  if (index > -1) {
    renamingResults.value.splice(index, 1)
  }
}

const skipRename = (emojiId: string) => {
  const index = renamingResults.value.findIndex(r => r.emojiId === emojiId)
  if (index > -1) {
    renamingResults.value.splice(index, 1)
  }
}

const applyAllRenames = () => {
  const toApply = renamingResults.value.filter(r => r.selectedSuggestion !== null)

  if (toApply.length === 0) {
    message.warning('没有选择任何重命名建议')
    return
  }

  toApply.forEach(result => {
    const newName = result.suggestions[result.selectedSuggestion!]
    // Apply rename logic here
  })

  message.success(`已应用 ${toApply.length} 个重命名`)
  renamingResults.value = []
}

const clearResults = () => {
  renamingResults.value = []
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Lifecycle
onMounted(() => {
  // Check for browser AI availability
  if ('ai' in window) {
    browserAIStatus.value.chrome = true
  }

  if ('navigator' in window && 'ml' in navigator) {
    browserAIStatus.value.edge = true
  }
})
</script>

<template>
  <div v-if="activeTab === 'emoji-naming'" class="space-y-6">
    <div class="bg-gradient-to-br from-orange-600 to-red-700 text-white p-6 rounded-lg">
      <h2 class="text-2xl font-bold mb-4">🤖 AI 表情符号重命名系统</h2>
      <p class="text-orange-100">
        使用多种 AI 提供商智能识别和重命名表情，支持批量处理和多种命名建议
      </p>
    </div>

    <!-- Provider Configuration -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">🔧 AI 提供商选择</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <a-card
          v-for="provider in aiProviders"
          :key="provider.id"
          :class="selectedAIProvider === provider.id ? 'border-blue-500 bg-blue-50' : ''"
          class="cursor-pointer transition-all hover:shadow-md"
          @click="selectAIProvider(provider.id)"
        >
          <div class="text-center">
            <div class="text-3xl mb-2">{{ provider.icon }}</div>
            <h4 class="font-semibold">{{ provider.name }}</h4>
            <p class="text-sm text-gray-600 mt-1">{{ provider.description }}</p>
            <div class="mt-2">
              <a-tag :color="provider.supportsDirectUrl ? 'blue' : 'orange'">
                {{ provider.supportsDirectUrl ? '直接URL' : '需要缓存' }}
              </a-tag>
            </div>
          </div>
        </a-card>
      </div>

      <!-- API Configuration -->
      <div class="border-t pt-6">
        <!-- Google Gemini -->
        <div v-if="selectedAIProvider === 'gemini'" class="space-y-4">
          <h4 class="font-semibold text-lg">🔍 Google Gemini 配置</h4>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <a-input
              v-model:value="aiConfigs.gemini.apiKey"
              placeholder="输入 Google Gemini API Key"
              type="password"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">模型</label>
            <a-select v-model:value="aiConfigs.gemini.model" class="w-full">
              <a-select-option value="gemini-1.5-flash">Gemini 1.5 Flash</a-select-option>
              <a-select-option value="gemini-1.5-pro">Gemini 1.5 Pro</a-select-option>
            </a-select>
          </div>
        </div>

        <!-- OpenAI GPT-4o -->
        <div v-if="selectedAIProvider === 'openai'" class="space-y-4">
          <h4 class="font-semibold text-lg">🤖 OpenAI GPT-4o 配置</h4>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <a-input
              v-model:value="aiConfigs.openai.apiKey"
              placeholder="输入 OpenAI API Key"
              type="password"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">模型</label>
            <a-select v-model:value="aiConfigs.openai.model" class="w-full">
              <a-select-option value="gpt-4o">GPT-4o</a-select-option>
              <a-select-option value="gpt-4-vision-preview">GPT-4 Vision</a-select-option>
            </a-select>
          </div>
        </div>

        <!-- Anthropic Claude -->
        <div v-if="selectedAIProvider === 'claude'" class="space-y-4">
          <h4 class="font-semibold text-lg">🎭 Anthropic Claude 配置</h4>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <a-input
              v-model:value="aiConfigs.claude.apiKey"
              placeholder="输入 Anthropic API Key"
              type="password"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">模型</label>
            <a-select v-model:value="aiConfigs.claude.model" class="w-full">
              <a-select-option value="claude-3-5-sonnet-20241022">
                Claude 3.5 Sonnet
              </a-select-option>
              <a-select-option value="claude-3-haiku-20240307">Claude 3 Haiku</a-select-option>
            </a-select>
          </div>
        </div>

        <!-- OpenAI Compatible APIs -->
        <div v-if="selectedAIProvider === 'openai-compatible'" class="space-y-4">
          <h4 class="font-semibold text-lg">🔗 OpenAI 兼容 API 配置</h4>
          <div>
            <label class="block text-sm font-medium mb-2">API Endpoint</label>
            <a-input
              v-model:value="aiConfigs.openaiCompatible.endpoint"
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <a-input
              v-model:value="aiConfigs.openaiCompatible.apiKey"
              placeholder="输入 API Key"
              type="password"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">模型名称</label>
            <a-input v-model:value="aiConfigs.openaiCompatible.model" placeholder="model-name" />
          </div>
        </div>

        <!-- Chrome AI -->
        <div v-if="selectedAIProvider === 'chrome-ai'" class="space-y-4">
          <h4 class="font-semibold text-lg">🌐 Chrome AI 配置</h4>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center space-x-2 mb-2">
              <div
                class="w-3 h-3 rounded-full"
                :class="browserAIStatus.chrome ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="font-medium">Chrome AI 状态</span>
            </div>
            <p class="text-sm text-gray-600">
              需要 Chrome 127+ 并启用 AI 功能。本地处理，无需 API 密钥。
            </p>
          </div>
        </div>

        <!-- Edge AI -->
        <div v-if="selectedAIProvider === 'edge-ai'" class="space-y-4">
          <h4 class="font-semibold text-lg">🔷 Edge AI 配置</h4>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center space-x-2 mb-2">
              <div
                class="w-3 h-3 rounded-full"
                :class="browserAIStatus.edge ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="font-medium">Edge AI 状态</span>
            </div>
            <p class="text-sm text-gray-600">使用 Microsoft Edge AI 写作辅助 API 进行图像理解。</p>
          </div>
        </div>

        <a-button @click="testAIConnection" :loading="testingAI" class="mt-4">测试连接</a-button>
      </div>
    </div>

    <!-- Emoji Selection and Processing -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">📱 表情选择与处理</h3>

      <!-- Emoji Grid -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <h4 class="font-medium">选择要重命名的表情</h4>
          <div class="space-x-2">
            <a-button size="small" @click="selectAllEmojis">全选</a-button>
            <a-button size="small" @click="clearSelection">清除选择</a-button>
          </div>
        </div>

        <div
          class="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-2 max-h-64 overflow-y-auto border rounded p-4"
        >
          <div
            v-for="emoji in availableEmojis"
            :key="emoji.id"
            :class="
              selectedEmojis.has(emoji.id)
                ? 'border-2 border-blue-500 bg-blue-50'
                : 'border border-gray-200'
            "
            class="w-12 h-12 rounded cursor-pointer transition-all hover:scale-110 flex items-center justify-center"
            @click="toggleEmojiSelection(emoji)"
          >
            <img :src="emoji.url" :alt="emoji.name" class="w-10 h-10 object-cover rounded" />
          </div>
        </div>

        <div class="mt-2 text-sm text-gray-600">已选择 {{ selectedEmojis.size }} 个表情</div>
      </div>

      <!-- Processing Options -->
      <div class="space-y-4 mb-6">
        <div>
          <label class="block text-sm font-medium mb-2">重命名提示词模板</label>
          <a-textarea
            v-model:value="namingPrompt"
            :rows="3"
            placeholder="分析这个表情包图像，为它提供 3-5 个简洁、准确的中文名称建议..."
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">命名风格</label>
            <a-select v-model:value="namingStyle" class="w-full">
              <a-select-option value="descriptive">描述性 (描述动作/表情)</a-select-option>
              <a-select-option value="emotional">情感性 (表达情绪)</a-select-option>
              <a-select-option value="casual">随意性 (口语化)</a-select-option>
              <a-select-option value="formal">正式性 (标准用词)</a-select-option>
            </a-select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">建议数量</label>
            <a-input-number v-model:value="suggestionCount" :min="1" :max="10" />
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex space-x-4">
        <a-button
          type="primary"
          @click="startBatchRenaming"
          :loading="processing"
          :disabled="selectedEmojis.size === 0 || !isAIConfigured"
        >
          {{ processing ? '处理中...' : '开始批量重命名' }}
        </a-button>

        <a-button @click="cacheSelectedEmojis" :disabled="selectedEmojis.size === 0">
          缓存选中表情
        </a-button>
      </div>
    </div>

    <!-- Processing Progress -->
    <div v-if="processing" class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">🔄 处理进度</h3>

      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">总体进度</span>
            <span class="text-sm text-gray-500">
              {{ processingStatus.current }}/{{ processingStatus.total }}
            </span>
          </div>
          <a-progress
            :percent="Math.round((processingStatus.current / processingStatus.total) * 100)"
          />
        </div>

        <div class="text-sm text-gray-600">当前: {{ processingStatus.currentEmoji }}</div>

        <div class="text-sm">状态: {{ processingStatus.message }}</div>
      </div>
    </div>

    <!-- Renaming Results -->
    <div v-if="renamingResults.length > 0" class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">✨ 重命名建议</h3>

      <div class="space-y-4">
        <div v-for="result in renamingResults" :key="result.emojiId" class="border rounded-lg p-4">
          <div class="flex items-start space-x-4">
            <!-- Emoji Preview -->
            <img
              :src="result.emoji.url"
              :alt="result.emoji.name"
              class="w-16 h-16 object-cover rounded border"
            />

            <!-- Current and Suggested Names -->
            <div class="flex-1">
              <div class="mb-2">
                <span class="text-sm font-medium text-gray-600">当前名称:</span>
                <span class="ml-2">{{ result.emoji.name }}</span>
              </div>

              <div class="mb-3">
                <span class="text-sm font-medium text-gray-600">AI 建议:</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <a-button
                  v-for="(suggestion, index) in result.suggestions"
                  :key="index"
                  size="small"
                  :type="result.selectedSuggestion === index ? 'primary' : 'default'"
                  @click="selectSuggestion(result.emojiId, index)"
                  class="text-left justify-start"
                >
                  {{ suggestion }}
                </a-button>
              </div>

              <div class="mt-3 flex space-x-2">
                <a-button
                  size="small"
                  type="primary"
                  @click="applyRename(result)"
                  :disabled="result.selectedSuggestion === null"
                >
                  应用重命名
                </a-button>

                <a-button size="small" @click="skipRename(result.emojiId)">跳过</a-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 flex space-x-4">
        <a-button type="primary" @click="applyAllRenames">应用所有重命名</a-button>

        <a-button @click="clearResults">清除结果</a-button>
      </div>
    </div>
  </div>
</template>
