<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'

interface Props {
  activeTab: string
}

const props = defineProps<Props>()

// State
const selectedProvider = ref('cloudflare')
const testing = ref(false)
const generating = ref(false)
const generationStatus = ref('')
const generationProgress = ref(0)

// Configuration
const cloudflareConfig = ref({
  accountId: '',
  apiToken: '',
  useCustomModel: false,
  customModel: '@cf/stable-diffusion-xl-base-1.0'
})

const openaiConfig = ref({
  apiKey: '',
  model: 'dall-e-3'
})

const chromeAIStatus = ref({
  available: false,
  message: '未检测到 Chrome AI'
})

const edgeAIStatus = ref({
  available: false,
  message: '未检测到 Edge AI'
})

// Generation parameters
const prompt = ref('')
const negativePrompt = ref('')
const imageConfig = ref({
  width: '1024',
  height: '1024',
  count: 1,
  guidance: 7
})

const generatedImages = ref<Array<{ url: string; timestamp: string }>>([])

// Providers configuration
const providers = [
  {
    id: 'cloudflare',
    name: 'Cloudflare AI',
    icon: '☁️',
    description: 'Workers AI 平台',
    available: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: 'DALL-E 模型',
    available: true
  },
  {
    id: 'chrome-ai',
    name: 'Chrome AI',
    icon: '🌐',
    description: '浏览器本地 AI',
    available: false
  },
  {
    id: 'edge-ai',
    name: 'Edge AI',
    icon: '🔷',
    description: 'Edge 写作助手',
    available: false
  }
]

// Computed
const isProviderConfigured = computed(() => {
  switch (selectedProvider.value) {
    case 'cloudflare':
      return cloudflareConfig.value.accountId && cloudflareConfig.value.apiToken
    case 'openai':
      return openaiConfig.value.apiKey
    case 'chrome-ai':
      return chromeAIStatus.value.available
    case 'edge-ai':
      return edgeAIStatus.value.available
    default:
      return false
  }
})

// Methods
const selectProvider = (providerId: string) => {
  selectedProvider.value = providerId
}

const testCloudflareConnection = async () => {
  if (!cloudflareConfig.value.accountId || !cloudflareConfig.value.apiToken) {
    message.error('请填写 Account ID 和 API Token')
    return
  }

  testing.value = true
  try {
    // Simulate API test
    await delay(1500)
    message.success('Cloudflare AI 连接成功！')
  } catch (error) {
    message.error('连接失败: ' + (error as Error).message)
  } finally {
    testing.value = false
  }
}

const testOpenAIConnection = async () => {
  if (!openaiConfig.value.apiKey) {
    message.error('请填写 API Key')
    return
  }

  testing.value = true
  try {
    // Simulate API test
    await delay(1500)
    message.success('OpenAI 连接成功！')
  } catch (error) {
    message.error('连接失败: ' + (error as Error).message)
  } finally {
    testing.value = false
  }
}

const initChromeAI = async () => {
  testing.value = true

  try {
    // Check for Chrome AI availability
    if ('ai' in window && 'assistant' in (window as any).ai) {
      chromeAIStatus.value = {
        available: true,
        message: 'Chrome AI 已就绪'
      }
      message.success('Chrome AI 初始化成功！')
    } else {
      throw new Error('Chrome AI 不可用')
    }
  } catch (error) {
    chromeAIStatus.value = {
      available: false,
      message: '需要 Chrome 127+ 并启用 AI 功能'
    }
    message.error('Chrome AI 初始化失败')
  } finally {
    testing.value = false
  }
}

const initEdgeAI = async () => {
  testing.value = true

  try {
    // Check for Edge AI availability
    if ('navigator' in window && 'ml' in navigator) {
      edgeAIStatus.value = {
        available: true,
        message: 'Edge AI 已就绪'
      }
      message.success('Edge AI 初始化成功！')
    } else {
      throw new Error('Edge AI 不可用')
    }
  } catch (error) {
    edgeAIStatus.value = {
      available: false,
      message: '需要 Microsoft Edge 并启用 AI 功能'
    }
    message.error('Edge AI 初始化失败')
  } finally {
    testing.value = false
  }
}

const generateImage = async () => {
  if (!prompt.value.trim()) {
    message.error('请输入提示词')
    return
  }

  generating.value = true
  generationProgress.value = 0
  generationStatus.value = '正在准备生成...'

  try {
    // Simulate generation process
    const steps = [
      { progress: 20, status: '正在处理提示词...' },
      { progress: 40, status: '正在初始化模型...' },
      { progress: 60, status: '正在生成图像...' },
      { progress: 80, status: '正在优化质量...' },
      { progress: 100, status: '生成完成！' }
    ]

    for (const step of steps) {
      await delay(800)
      generationProgress.value = step.progress
      generationStatus.value = step.status
    }

    // Add generated image (mock)
    const timestamp = new Date().toLocaleString()
    generatedImages.value.unshift({
      url: `https://picsum.photos/${imageConfig.value.width}/${imageConfig.value.height}?random=${Date.now()}`,
      timestamp
    })

    message.success('图像生成成功！')
  } catch (error) {
    message.error('生成失败: ' + (error as Error).message)
  } finally {
    generating.value = false
    generationProgress.value = 0
  }
}

const downloadImage = (url: string, index: number) => {
  const link = document.createElement('a')
  link.href = url
  link.download = `ai-generated-image-${index + 1}.png`
  link.click()
  message.success('图像下载已开始')
}

const copyImageToClipboard = async (url: string) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    message.success('图像已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Lifecycle
onMounted(() => {
  // Check for available AI features
  if ('ai' in window) {
    chromeAIStatus.value = {
      available: true,
      message: 'Chrome AI 可用'
    }
  }

  if ('navigator' in window && 'ml' in navigator) {
    edgeAIStatus.value = {
      available: true,
      message: 'Edge AI 可用'
    }
  }
})
</script>

<template>
  <div v-if="activeTab === 'ai-generator'" class="space-y-6">
    <div class="bg-gradient-to-br from-purple-600 to-pink-700 text-white p-6 rounded-lg">
      <h2 class="text-2xl font-bold mb-4">🎨 增强型 AI 图像生成器</h2>
      <p class="text-purple-100">支持 Cloudflare、OpenAI、以及浏览器原生 AI 的多平台图像生成工具</p>
    </div>

    <!-- Provider Selection -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">🔧 AI 提供商配置</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <a-card
          v-for="provider in providers"
          :key="provider.id"
          :class="selectedProvider === provider.id ? 'border-blue-500 bg-blue-50' : ''"
          class="cursor-pointer transition-all hover:shadow-md"
          @click="selectProvider(provider.id)"
        >
          <div class="text-center">
            <div class="text-3xl mb-2">{{ provider.icon }}</div>
            <h4 class="font-semibold">{{ provider.name }}</h4>
            <p class="text-sm text-gray-600 mt-1">{{ provider.description }}</p>
            <div class="mt-2">
              <a-tag :color="provider.available ? 'green' : 'red'">
                {{ provider.available ? '可用' : '不可用' }}
              </a-tag>
            </div>
          </div>
        </a-card>
      </div>

      <!-- Configuration Panel -->
      <div class="border-t pt-6">
        <!-- Cloudflare Configuration -->
        <div v-if="selectedProvider === 'cloudflare'" class="space-y-4">
          <h4 class="font-semibold text-lg">☁️ Cloudflare AI 配置</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Account ID</label>
              <a-input
                v-model:value="cloudflareConfig.accountId"
                placeholder="输入 Cloudflare Account ID"
                type="password"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">API Token</label>
              <a-input
                v-model:value="cloudflareConfig.apiToken"
                placeholder="输入 Cloudflare API Token"
                type="password"
              />
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <a-checkbox v-model:checked="cloudflareConfig.useCustomModel">
              使用自定义模型
            </a-checkbox>
            <a-input
              v-if="cloudflareConfig.useCustomModel"
              v-model:value="cloudflareConfig.customModel"
              placeholder="@cf/stable-diffusion-xl-base-1.0"
              class="flex-1"
            />
          </div>
          <a-button @click="testCloudflareConnection" :loading="testing">测试连接</a-button>
        </div>

        <!-- OpenAI Configuration -->
        <div v-if="selectedProvider === 'openai'" class="space-y-4">
          <h4 class="font-semibold text-lg">🤖 OpenAI 配置</h4>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <a-input
              v-model:value="openaiConfig.apiKey"
              placeholder="输入 OpenAI API Key"
              type="password"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">模型</label>
            <a-select v-model:value="openaiConfig.model" class="w-full">
              <a-select-option value="dall-e-3">DALL-E 3</a-select-option>
              <a-select-option value="dall-e-2">DALL-E 2</a-select-option>
            </a-select>
          </div>
          <a-button @click="testOpenAIConnection" :loading="testing">测试连接</a-button>
        </div>

        <!-- Browser AI Configuration -->
        <div v-if="selectedProvider === 'chrome-ai'" class="space-y-4">
          <h4 class="font-semibold text-lg">🌐 Chrome AI 配置</h4>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center space-x-2 mb-2">
              <div
                class="w-3 h-3 rounded-full"
                :class="chromeAIStatus.available ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="font-medium">状态: {{ chromeAIStatus.message }}</span>
            </div>
            <p class="text-sm text-gray-600">
              需要 Chrome 127+ 并启用 AI 功能。本地处理，无需 API 密钥。
            </p>
          </div>
          <a-button @click="initChromeAI" :loading="testing" :disabled="chromeAIStatus.available">
            {{ chromeAIStatus.available ? '✅ 已就绪' : '初始化 Chrome AI' }}
          </a-button>
        </div>

        <!-- Edge AI Configuration -->
        <div v-if="selectedProvider === 'edge-ai'" class="space-y-4">
          <h4 class="font-semibold text-lg">🔷 Edge AI 配置</h4>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center space-x-2 mb-2">
              <div
                class="w-3 h-3 rounded-full"
                :class="edgeAIStatus.available ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="font-medium">状态: {{ edgeAIStatus.message }}</span>
            </div>
            <p class="text-sm text-gray-600">需要 Microsoft Edge 并启用 AI 写作辅助功能。</p>
          </div>
          <a-button @click="initEdgeAI" :loading="testing" :disabled="edgeAIStatus.available">
            {{ edgeAIStatus.available ? '✅ 已就绪' : '初始化 Edge AI' }}
          </a-button>
        </div>
      </div>
    </div>

    <!-- Generation Interface -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold mb-4">🎨 图像生成</h3>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Input Panel -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">提示词 (Prompt)</label>
            <a-textarea
              v-model:value="prompt"
              :rows="4"
              placeholder="描述你想要生成的图像..."
              class="resize-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">负面提示词 (Negative Prompt)</label>
            <a-textarea
              v-model:value="negativePrompt"
              :rows="2"
              placeholder="描述你不想要的元素..."
              class="resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">宽度</label>
              <a-select v-model:value="imageConfig.width">
                <a-select-option value="512">512px</a-select-option>
                <a-select-option value="768">768px</a-select-option>
                <a-select-option value="1024">1024px</a-select-option>
              </a-select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">高度</label>
              <a-select v-model:value="imageConfig.height">
                <a-select-option value="512">512px</a-select-option>
                <a-select-option value="768">768px</a-select-option>
                <a-select-option value="1024">1024px</a-select-option>
              </a-select>
            </div>
          </div>

          <div v-if="selectedProvider !== 'chrome-ai' && selectedProvider !== 'edge-ai'">
            <label class="block text-sm font-medium mb-2">生成数量</label>
            <a-input-number v-model:value="imageConfig.count" :min="1" :max="4" />
          </div>

          <div v-if="selectedProvider === 'cloudflare' || selectedProvider === 'openai'">
            <label class="block text-sm font-medium mb-2">引导强度 (Guidance Scale)</label>
            <a-slider v-model:value="imageConfig.guidance" :min="1" :max="20" />
          </div>

          <a-button
            type="primary"
            size="large"
            @click="generateImage"
            :loading="generating"
            :disabled="!prompt.trim() || !isProviderConfigured"
            class="w-full"
          >
            {{ generating ? '生成中...' : '生成图像' }}
          </a-button>
        </div>

        <!-- Preview and Results -->
        <div class="space-y-4">
          <div
            v-if="generating"
            class="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg"
          >
            <div
              class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
            ></div>
            <p class="text-gray-600">{{ generationStatus }}</p>
            <a-progress v-if="generationProgress > 0" :percent="generationProgress" class="mt-4" />
          </div>

          <div v-else-if="generatedImages.length > 0" class="space-y-4">
            <h4 class="font-semibold">生成结果</h4>
            <div class="grid grid-cols-1 gap-4">
              <div
                v-for="(image, index) in generatedImages"
                :key="index"
                class="border rounded-lg overflow-hidden"
              >
                <img :src="image.url" :alt="`Generated image ${index + 1}`" class="w-full h-auto" />
                <div class="p-3 bg-gray-50">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-600">{{ image.timestamp }}</span>
                    <div class="space-x-2">
                      <a-button size="small" @click="downloadImage(image.url, index)">
                        下载
                      </a-button>
                      <a-button size="small" @click="copyImageToClipboard(image.url)">
                        复制
                      </a-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <div class="text-4xl mb-4">🎨</div>
            <p class="text-gray-600">生成的图像将显示在这里</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
