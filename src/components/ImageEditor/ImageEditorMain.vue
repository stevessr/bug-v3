<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'

const canvas = ref<HTMLCanvasElement>()
const ctx = ref<CanvasRenderingContext2D | null>(null)
const fileInput = ref<HTMLInputElement>()
const imageLoaded = ref(false)
const isDragOver = ref(false)
const activeTool = ref('select')
const selectedColor = ref('#000000')
const brushSize = ref(10)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const originalImageData = ref<ImageData | null>(null)
const showTextModal = ref(false)
const textInput = ref('')

const adjustments = ref({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0
})

const tools = [
  { id: 'select', name: '选择', icon: '👆' },
  { id: 'crop', name: '裁剪', icon: '✂️' },
  { id: 'brush', name: '画笔', icon: '🖌️' },
  { id: 'text', name: '文字', icon: '📝' },
  { id: 'shape', name: '形状', icon: '⭕' },
  { id: 'eraser', name: '橡皮', icon: '🧹' }
]

const filters = [
  { id: 'none', name: '无' },
  { id: 'grayscale', name: '黑白' },
  { id: 'sepia', name: '怀旧' },
  { id: 'blur', name: '模糊' },
  { id: 'sharpen', name: '锐化' },
  { id: 'vintage', name: '复古' }
]

const currentToolName = computed(() => {
  const tool = tools.find(t => t.id === activeTool.value)
  return tool ? tool.name : ''
})

onMounted(() => {
  initCanvas()
})

const initCanvas = () => {
  if (canvas.value) {
    ctx.value = canvas.value.getContext('2d')
    canvas.value.width = canvasWidth.value
    canvas.value.height = canvasHeight.value

    // 设置画布背景
    if (ctx.value) {
      ctx.value.fillStyle = '#ffffff'
      ctx.value.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
    }
  }
}

const loadImage = () => {
  fileInput.value?.click()
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    handleFile(target.files[0])
  }
}

const handleFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  const reader = new FileReader()
  reader.onload = e => {
    const img = new Image()
    img.onload = () => {
      // 调整画布大小以适应图片
      canvasWidth.value = Math.min(img.width, 1200)
      canvasHeight.value = Math.min(img.height, 800)

      nextTick(() => {
        initCanvas()
        if (ctx.value) {
          // 绘制图片
          ctx.value.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value)

          // 保存原始图像数据
          originalImageData.value = ctx.value.getImageData(
            0,
            0,
            canvasWidth.value,
            canvasHeight.value
          )
          imageLoaded.value = true
        }
      })
    }
    img.src = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

const selectTool = (toolId: string) => {
  activeTool.value = toolId

  if (toolId === 'text') {
    showTextModal.value = true
  }
}

const applyAdjustments = () => {
  if (!ctx.value || !originalImageData.value) return

  // 恢复原始图像
  ctx.value.putImageData(originalImageData.value, 0, 0)

  // 应用调整
  const imageData = ctx.value.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // 亮度调整
    const brightnessFactor = adjustments.value.brightness / 100
    data[i] = Math.max(0, Math.min(255, data[i] + brightnessFactor * 255))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightnessFactor * 255))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightnessFactor * 255))

    // 对比度调整
    const contrastFactor =
      (259 * (adjustments.value.contrast + 255)) / (255 * (259 - adjustments.value.contrast))
    data[i] = Math.max(0, Math.min(255, contrastFactor * (data[i] - 128) + 128))
    data[i + 1] = Math.max(0, Math.min(255, contrastFactor * (data[i + 1] - 128) + 128))
    data[i + 2] = Math.max(0, Math.min(255, contrastFactor * (data[i + 2] - 128) + 128))
  }

  ctx.value.putImageData(imageData, 0, 0)
}

const applyFilter = (filterId: string) => {
  if (!ctx.value) return

  switch (filterId) {
    case 'none':
      if (originalImageData.value) {
        ctx.value.putImageData(originalImageData.value, 0, 0)
      }
      break
    case 'grayscale':
      applyGrayscaleFilter()
      break
    case 'sepia':
      applySepiaFilter()
      break
    case 'blur':
      applyBlurFilter()
      break
  }
}

const applyGrayscaleFilter = () => {
  if (!ctx.value) return

  const imageData = ctx.value.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }

  ctx.value.putImageData(imageData, 0, 0)
}

const applySepiaFilter = () => {
  if (!ctx.value) return

  const imageData = ctx.value.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
  }

  ctx.value.putImageData(imageData, 0, 0)
}

const applyBlurFilter = () => {
  if (!ctx.value) return

  ctx.value.filter = 'blur(2px)'
  const imageData = ctx.value.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  ctx.value.filter = 'none'
  ctx.value.putImageData(imageData, 0, 0)
}

const addText = () => {
  if (!ctx.value || !textInput.value.trim()) return

  ctx.value.font = '24px Arial'
  ctx.value.fillStyle = selectedColor.value
  ctx.value.fillText(textInput.value, 50, 50)

  textInput.value = ''
  showTextModal.value = false
}

const saveImage = () => {
  if (!canvas.value) return

  const link = document.createElement('a')
  link.download = 'edited-image.png'
  link.href = canvas.value.toDataURL()
  link.click()
}

const resetImage = () => {
  if (originalImageData.value && ctx.value) {
    ctx.value.putImageData(originalImageData.value, 0, 0)
    adjustments.value = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">✂️ 图片编辑器</h1>
            <p class="text-sm text-gray-600">专业的在线图片编辑工具，支持裁剪、滤镜、调色等功能</p>
          </div>
          <div class="flex space-x-2">
            <button
              v-if="!imageLoaded"
              @click="loadImage"
              class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              加载图片
            </button>
            <button
              v-if="imageLoaded"
              @click="saveImage"
              class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              保存图片
            </button>
            <button
              v-if="imageLoaded"
              @click="resetImage"
              class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="flex h-screen">
      <!-- Toolbar -->
      <div v-if="imageLoaded" class="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <div class="space-y-6">
          <!-- Tools -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">工具</h3>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="tool in tools"
                :key="tool.id"
                @click="selectTool(tool.id)"
                class="p-3 rounded-lg text-center transition-colors border"
                :class="[
                  activeTool === tool.id
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                ]"
              >
                <div class="text-lg mb-1">{{ tool.icon }}</div>
                <div class="text-xs">{{ tool.name }}</div>
              </button>
            </div>
          </div>

          <!-- Adjustments -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">调整</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-xs text-gray-600 mb-1">亮度</label>
                <input
                  v-model="adjustments.brightness"
                  @input="applyAdjustments"
                  type="range"
                  min="-100"
                  max="100"
                  class="w-full"
                />
                <div class="text-xs text-gray-500 text-center">{{ adjustments.brightness }}</div>
              </div>

              <div>
                <label class="block text-xs text-gray-600 mb-1">对比度</label>
                <input
                  v-model="adjustments.contrast"
                  @input="applyAdjustments"
                  type="range"
                  min="-100"
                  max="100"
                  class="w-full"
                />
                <div class="text-xs text-gray-500 text-center">{{ adjustments.contrast }}</div>
              </div>

              <div>
                <label class="block text-xs text-gray-600 mb-1">饱和度</label>
                <input
                  v-model="adjustments.saturation"
                  @input="applyAdjustments"
                  type="range"
                  min="-100"
                  max="100"
                  class="w-full"
                />
                <div class="text-xs text-gray-500 text-center">{{ adjustments.saturation }}</div>
              </div>

              <div>
                <label class="block text-xs text-gray-600 mb-1">色调</label>
                <input
                  v-model="adjustments.hue"
                  @input="applyAdjustments"
                  type="range"
                  min="-180"
                  max="180"
                  class="w-full"
                />
                <div class="text-xs text-gray-500 text-center">{{ adjustments.hue }}</div>
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">滤镜</h3>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="filter in filters"
                :key="filter.id"
                @click="applyFilter(filter.id)"
                class="p-2 rounded-lg text-xs bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {{ filter.name }}
              </button>
            </div>
          </div>

          <!-- Colors -->
          <div v-if="activeTool === 'brush' || activeTool === 'text'">
            <h3 class="text-sm font-medium text-gray-900 mb-3">颜色</h3>
            <input
              v-model="selectedColor"
              type="color"
              class="w-full h-10 rounded border border-gray-300"
            />
          </div>

          <!-- Brush Size -->
          <div v-if="activeTool === 'brush'">
            <h3 class="text-sm font-medium text-gray-900 mb-3">画笔大小</h3>
            <input v-model="brushSize" type="range" min="1" max="50" class="w-full" />
            <div class="text-xs text-gray-500 text-center">{{ brushSize }}px</div>
          </div>
        </div>
      </div>

      <!-- Main Canvas Area -->
      <div class="flex-1 flex flex-col">
        <!-- Canvas Container -->
        <div class="flex-1 flex items-center justify-center p-4">
          <div v-if="!imageLoaded" class="text-center">
            <div
              @drop="handleDrop"
              @dragover.prevent
              @dragenter.prevent
              class="border-2 border-dashed rounded-lg p-12 transition-colors"
              :class="[isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300']"
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handleFileSelect"
                class="hidden"
              />

              <svg
                class="mx-auto h-16 w-16 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p class="mt-4 text-lg text-gray-600">
                拖拽图片到这里或
                <button @click="loadImage" class="text-blue-600 hover:text-blue-500">
                  点击选择图片
                </button>
              </p>
              <p class="text-sm text-gray-500 mt-2">支持 PNG, JPG, WebP, GIF 等格式</p>
            </div>
          </div>

          <div v-else class="relative">
            <canvas
              ref="canvas"
              class="border border-gray-300 rounded-lg shadow-lg max-w-full max-h-full"
            ></canvas>
          </div>
        </div>

        <!-- Status Bar -->
        <div
          v-if="imageLoaded"
          class="bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center text-sm text-gray-600"
        >
          <div>尺寸: {{ canvasWidth }} × {{ canvasHeight }}</div>
          <div>工具: {{ currentToolName }}</div>
        </div>
      </div>
    </div>

    <!-- Text Input Modal -->
    <div
      v-if="showTextModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-medium text-gray-900 mb-4">添加文字</h3>
        <input
          v-model="textInput"
          @keyup.enter="addText"
          type="text"
          placeholder="请输入文字内容"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 mb-4"
        />
        <div class="flex justify-end space-x-2">
          <button
            @click="showTextModal = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            取消
          </button>
          <button
            @click="addText"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
