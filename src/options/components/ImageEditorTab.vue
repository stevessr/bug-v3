<template>
  <div v-if="activeTab === 'image-editor'" class="space-y-6">
    <div class="bg-gradient-to-br from-green-600 to-blue-700 text-white p-6 rounded-lg">
      <h2 class="text-2xl font-bold mb-4">✂️ 专业图像编辑器</h2>
      <p class="text-green-100">
        基于画布的全面图像编辑工具，包含工具、调整和滤镜功能
      </p>
    </div>

    <!-- Image Upload Area -->
    <div v-if="!currentImage" class="bg-white rounded-lg shadow-md p-8">
      <div 
        class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
        @drop="handleImageDrop"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @click="triggerImageUpload"
      >
        <input 
          ref="imageInput" 
          type="file" 
          accept="image/*" 
          @change="handleImageUpload"
          class="hidden"
        />
        <div class="text-6xl mb-4">🖼️</div>
        <p class="text-gray-600 mb-2 text-lg">拖拽图像到此处或点击选择</p>
        <p class="text-gray-400">支持: PNG, JPG, WebP, GIF</p>
      </div>
    </div>

    <!-- Editor Interface -->
    <div v-if="currentImage" class="bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Toolbar -->
      <div class="border-b border-gray-200 p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">图像编辑器</h3>
          <div class="flex space-x-2">
            <a-button @click="saveImage" type="primary">保存图像</a-button>
            <a-button @click="resetImage">重置</a-button>
            <a-button @click="clearImage" danger>清除</a-button>
          </div>
        </div>

        <!-- Tools -->
        <div class="flex flex-wrap gap-2 mb-4">
          <a-button 
            v-for="tool in tools" 
            :key="tool.id"
            :type="selectedTool === tool.id ? 'primary' : 'default'"
            @click="selectTool(tool.id)"
            size="small"
          >
            {{ tool.icon }} {{ tool.name }}
          </a-button>
        </div>

        <!-- Tool-specific controls -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Brush Size (for brush and eraser) -->
          <div v-if="selectedTool === 'brush' || selectedTool === 'eraser'" class="space-y-2">
            <label class="block text-sm font-medium">画笔大小</label>
            <a-slider v-model:value="brushSize" :min="1" :max="50" />
          </div>

          <!-- Brush Color (for brush and text) -->
          <div v-if="selectedTool === 'brush' || selectedTool === 'text'" class="space-y-2">
            <label class="block text-sm font-medium">颜色</label>
            <input type="color" v-model="brushColor" class="w-full h-8 rounded border" />
          </div>

          <!-- Text Input -->
          <div v-if="selectedTool === 'text'" class="space-y-2">
            <label class="block text-sm font-medium">文本</label>
            <a-input v-model:value="textInput" placeholder="输入文本" />
          </div>

          <!-- Font Size -->
          <div v-if="selectedTool === 'text'" class="space-y-2">
            <label class="block text-sm font-medium">字体大小</label>
            <a-input-number v-model:value="fontSize" :min="8" :max="72" />
          </div>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="p-4">
        <div class="flex">
          <!-- Main Canvas -->
          <div class="flex-1">
            <div class="relative" style="max-height: 600px; overflow: auto;">
              <canvas 
                ref="canvas"
                :width="canvasWidth"
                :height="canvasHeight"
                class="border border-gray-300 cursor-crosshair max-w-full"
                @mousedown="startDrawing"
                @mousemove="draw"
                @mouseup="stopDrawing"
                @mouseleave="stopDrawing"
                @click="handleCanvasClick"
              ></canvas>
            </div>
            
            <!-- Zoom Controls -->
            <div class="flex items-center space-x-2 mt-4">
              <span class="text-sm text-gray-600">缩放:</span>
              <a-button size="small" @click="zoomOut">-</a-button>
              <span class="text-sm min-w-[60px] text-center">{{ Math.round(zoom * 100) }}%</span>
              <a-button size="small" @click="zoomIn">+</a-button>
              <a-button size="small" @click="resetZoom">重置</a-button>
            </div>
          </div>

          <!-- Adjustments Panel -->
          <div class="w-64 ml-6 space-y-6">
            <!-- Real-time Adjustments -->
            <div class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-medium mb-3">实时调整</h4>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">亮度</label>
                  <a-slider v-model:value="adjustments.brightness" :min="-100" :max="100" @change="applyAdjustments" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">对比度</label>
                  <a-slider v-model:value="adjustments.contrast" :min="-100" :max="100" @change="applyAdjustments" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">饱和度</label>
                  <a-slider v-model:value="adjustments.saturation" :min="-100" :max="100" @change="applyAdjustments" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">色相</label>
                  <a-slider v-model:value="adjustments.hue" :min="-180" :max="180" @change="applyAdjustments" />
                </div>
              </div>
            </div>

            <!-- Filters -->
            <div class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-medium mb-3">滤镜效果</h4>
              <div class="grid grid-cols-2 gap-2">
                <a-button 
                  v-for="filter in filters" 
                  :key="filter.id"
                  size="small"
                  @click="applyFilter(filter.id)"
                  class="text-xs"
                >
                  {{ filter.name }}
                </a-button>
              </div>
            </div>

            <!-- History -->
            <div class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-medium mb-3">历史记录</h4>
              <div class="flex space-x-2">
                <a-button size="small" @click="undo" :disabled="!canUndo">撤销</a-button>
                <a-button size="small" @click="redo" :disabled="!canRedo">重做</a-button>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                {{ history.length }} 个步骤
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'

interface Props {
  activeTab: string
}

const props = defineProps<Props>()

// Canvas and image state
const canvas = ref<HTMLCanvasElement>()
const imageInput = ref<HTMLInputElement>()
const currentImage = ref<HTMLImageElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const zoom = ref(1)

// Drawing state
const isDrawing = ref(false)
const selectedTool = ref('select')
const brushSize = ref(5)
const brushColor = ref('#000000')
const textInput = ref('')
const fontSize = ref(16)

// Adjustments
const adjustments = ref({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0
})

// History for undo/redo
const history = ref<ImageData[]>([])
const historyIndex = ref(-1)

// Tools configuration
const tools = [
  { id: 'select', name: '选择', icon: '👆' },
  { id: 'crop', name: '裁剪', icon: '✂️' },
  { id: 'brush', name: '画笔', icon: '🖌️' },
  { id: 'text', name: '文本', icon: '📝' },
  { id: 'rectangle', name: '矩形', icon: '⬜' },
  { id: 'circle', name: '圆形', icon: '⭕' },
  { id: 'eraser', name: '橡皮擦', icon: '🧽' }
]

// Filters configuration
const filters = [
  { id: 'grayscale', name: '灰度' },
  { id: 'sepia', name: '棕褐色' },
  { id: 'blur', name: '模糊' },
  { id: 'sharpen', name: '锐化' },
  { id: 'vintage', name: '复古' },
  { id: 'invert', name: '反色' }
]

// Computed properties
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// Methods
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.currentTarget) {
    (e.currentTarget as HTMLElement).classList.add('border-blue-400', 'bg-blue-50')
  }
}

const handleDragLeave = (e: DragEvent) => {
  if (e.currentTarget) {
    (e.currentTarget as HTMLElement).classList.remove('border-blue-400', 'bg-blue-50')
  }
}

const handleImageDrop = (e: DragEvent) => {
  e.preventDefault()
  handleDragLeave(e)
  
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    loadImage(files[0])
  }
}

const triggerImageUpload = () => {
  imageInput.value?.click()
}

const handleImageUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    loadImage(target.files[0])
  }
}

const loadImage = (file: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      currentImage.value = img
      canvasWidth.value = img.width
      canvasHeight.value = img.height
      
      nextTick(() => {
        drawImageToCanvas()
        saveToHistory()
        message.success('图像加载成功！')
      })
    }
    img.src = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

const drawImageToCanvas = () => {
  if (!canvas.value || !currentImage.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  ctx.drawImage(currentImage.value, 0, 0, canvasWidth.value, canvasHeight.value)
}

const selectTool = (toolId: string) => {
  selectedTool.value = toolId
}

const startDrawing = (e: MouseEvent) => {
  if (selectedTool.value === 'brush' || selectedTool.value === 'eraser') {
    isDrawing.value = true
    draw(e)
  }
}

const draw = (e: MouseEvent) => {
  if (!isDrawing.value || !canvas.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  const rect = canvas.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / zoom.value
  const y = (e.clientY - rect.top) / zoom.value
  
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  
  if (selectedTool.value === 'brush') {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = brushColor.value
  } else if (selectedTool.value === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
  }
  
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y)
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    const ctx = canvas.value?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      saveToHistory()
    }
  }
}

const handleCanvasClick = (e: MouseEvent) => {
  if (selectedTool.value === 'text' && textInput.value) {
    const ctx = canvas.value?.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.value!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom.value
    const y = (e.clientY - rect.top) / zoom.value
    
    ctx.font = `${fontSize.value}px Arial`
    ctx.fillStyle = brushColor.value
    ctx.fillText(textInput.value, x, y)
    
    saveToHistory()
  }
}

const applyAdjustments = () => {
  if (!canvas.value || !currentImage.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  // Apply CSS filters for real-time preview
  const filters = [
    `brightness(${100 + adjustments.value.brightness}%)`,
    `contrast(${100 + adjustments.value.contrast}%)`,
    `saturate(${100 + adjustments.value.saturation}%)`,
    `hue-rotate(${adjustments.value.hue}deg)`
  ]
  
  canvas.value.style.filter = filters.join(' ')
}

const applyFilter = (filterId: string) => {
  if (!canvas.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  const imageData = ctx.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  const data = imageData.data
  
  switch (filterId) {
    case 'grayscale':
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      break
      
    case 'sepia':
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189))
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168))
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
      }
      break
      
    case 'invert':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i]
        data[i + 1] = 255 - data[i + 1]
        data[i + 2] = 255 - data[i + 2]
      }
      break
  }
  
  ctx.putImageData(imageData, 0, 0)
  saveToHistory()
  message.success(`${filters.find(f => f.id === filterId)?.name} 滤镜已应用`)
}

const saveToHistory = () => {
  if (!canvas.value) return
  
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  
  const imageData = ctx.getImageData(0, 0, canvasWidth.value, canvasHeight.value)
  
  // Remove any history after current index
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(imageData)
  historyIndex.value = history.value.length - 1
  
  // Limit history to 20 steps
  if (history.value.length > 20) {
    history.value = history.value.slice(1)
    historyIndex.value = history.value.length - 1
  }
}

const undo = () => {
  if (!canUndo.value || !canvas.value) return
  
  historyIndex.value--
  const ctx = canvas.value.getContext('2d')
  if (ctx && history.value[historyIndex.value]) {
    ctx.putImageData(history.value[historyIndex.value], 0, 0)
  }
}

const redo = () => {
  if (!canRedo.value || !canvas.value) return
  
  historyIndex.value++
  const ctx = canvas.value.getContext('2d')
  if (ctx && history.value[historyIndex.value]) {
    ctx.putImageData(history.value[historyIndex.value], 0, 0)
  }
}

const zoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.2, 5)
  updateCanvasScale()
}

const zoomOut = () => {
  zoom.value = Math.max(zoom.value / 1.2, 0.1)
  updateCanvasScale()
}

const resetZoom = () => {
  zoom.value = 1
  updateCanvasScale()
}

const updateCanvasScale = () => {
  if (canvas.value) {
    canvas.value.style.transform = `scale(${zoom.value})`
    canvas.value.style.transformOrigin = 'top left'
  }
}

const saveImage = () => {
  if (!canvas.value) return
  
  const link = document.createElement('a')
  link.download = 'edited-image.png'
  link.href = canvas.value.toDataURL()
  link.click()
  
  message.success('图像已保存！')
}

const resetImage = () => {
  drawImageToCanvas()
  adjustments.value = { brightness: 0, contrast: 0, saturation: 0, hue: 0 }
  if (canvas.value) {
    canvas.value.style.filter = ''
  }
  saveToHistory()
  message.success('图像已重置！')
}

const clearImage = () => {
  currentImage.value = null
  history.value = []
  historyIndex.value = -1
}
</script>

<style scoped>
.cursor-crosshair {
  cursor: crosshair;
}
</style>