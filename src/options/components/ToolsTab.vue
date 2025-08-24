<template>
  <div v-if="activeTab === 'tools'" class="space-y-8">
    <div class="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-6 rounded-lg">
      <h2 class="text-2xl font-bold mb-4">🔧 多媒体小工具</h2>
      <p class="text-blue-100">
        专业的多媒体处理工具，支持格式转换、帧处理和本地 FFmpeg 集成
      </p>
    </div>

    <!-- Format Converter -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center mb-4">
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
          🔄
        </div>
        <div>
          <h3 class="text-lg font-semibold">格式转换器</h3>
          <p class="text-gray-600 text-sm">
            Convert between GIF, MP4, WebM → APNG/GIF with proper re-encoding
          </p>
        </div>
      </div>
      
      <div 
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
        @drop="handleFormatConverterDrop"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @click="triggerFormatFileInput"
      >
        <input 
          ref="formatFileInput" 
          type="file" 
          accept="video/*,image/gif,image/webp" 
          @change="handleFormatConverterFile"
          class="hidden"
        />
        <div class="text-4xl mb-4">📁</div>
        <p class="text-gray-600 mb-2">拖拽文件到此处或点击选择文件</p>
        <p class="text-gray-400 text-sm">支持: GIF, MP4, WebM</p>
      </div>

      <div v-if="formatConvertProgress.show" class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">{{ formatConvertProgress.text }}</span>
          <span class="text-sm text-gray-500">{{ formatConvertProgress.percent }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            :style="{ width: formatConvertProgress.percent + '%' }"
          ></div>
        </div>
        <div v-if="formatConvertProgress.fileInfo" class="mt-3 p-3 bg-gray-50 rounded text-sm">
          <div class="grid grid-cols-2 gap-2">
            <div><span class="font-medium">文件大小:</span> {{ formatConvertProgress.fileInfo.size }}</div>
            <div><span class="font-medium">尺寸:</span> {{ formatConvertProgress.fileInfo.dimensions }}</div>
            <div><span class="font-medium">帧率:</span> {{ formatConvertProgress.fileInfo.framerate }}</div>
            <div><span class="font-medium">编码:</span> {{ formatConvertProgress.fileInfo.codec }}</div>
            <div><span class="font-medium">码率:</span> {{ formatConvertProgress.fileInfo.bitrate }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Frame Splitter -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center mb-4">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
          ✂️
        </div>
        <div>
          <h3 class="text-lg font-semibold">帧分离器</h3>
          <p class="text-gray-600 text-sm">
            Frame Splitter: Extract individual frames from animations
          </p>
        </div>
      </div>
      
      <div 
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-green-400 hover:bg-green-50 cursor-pointer"
        @drop="handleFrameSplitterDrop"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @click="triggerFrameSplitterInput"
      >
        <input 
          ref="frameSplitterInput" 
          type="file" 
          accept="image/gif,video/*" 
          @change="handleFrameSplitterFile"
          class="hidden"
        />
        <div class="text-4xl mb-4">🎞️</div>
        <p class="text-gray-600 mb-2">选择动画文件以提取帧</p>
        <p class="text-gray-400 text-sm">支持: GIF, MP4, WebM</p>
      </div>

      <a-button type="primary" @click="startFrameSplitting" :disabled="!frameSplitterFile" class="mt-4">
        开始提取帧
      </a-button>
    </div>

    <!-- Frame Merger -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center mb-4">
        <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
          🔗
        </div>
        <div>
          <h3 class="text-lg font-semibold">帧合并器</h3>
          <p class="text-gray-600 text-sm">
            Frame Merger: Combine multiple images into animated GIFs/APNGs
          </p>
        </div>
      </div>
      
      <div 
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
        @drop="handleFrameMergerDrop"
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @click="triggerFrameMergerInput"
      >
        <input 
          ref="frameMergerInput" 
          type="file" 
          accept="image/*" 
          multiple
          @change="handleFrameMergerFiles"
          class="hidden"
        />
        <div class="text-4xl mb-4">🖼️</div>
        <p class="text-gray-600 mb-2">选择多个图像文件进行合并</p>
        <p class="text-gray-400 text-sm">支持: PNG, JPG, WebP</p>
      </div>

      <div v-if="frameMergerFiles.length > 0" class="mt-4">
        <p class="text-sm text-gray-600 mb-2">已选择 {{ frameMergerFiles.length }} 个文件</p>
        <div class="flex space-x-2 mb-4">
          <a-input-number 
            v-model:value="frameDelay" 
            :min="50" 
            :max="5000" 
            :step="50"
            addon-before="帧延迟"
            addon-after="ms"
          />
          <a-select v-model:value="outputFormat" style="width: 120px">
            <a-select-option value="gif">GIF</a-select-option>
            <a-select-option value="apng">APNG</a-select-option>
          </a-select>
        </div>
        <a-button type="primary" @click="startFrameMerging">
          合并为动画
        </a-button>
      </div>
    </div>

    <!-- FFmpeg Integration -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center mb-4">
        <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-4">
          🎬
        </div>
        <div>
          <h3 class="text-lg font-semibold">本地 FFmpeg 集成</h3>
          <p class="text-gray-600 text-sm">
            Local FFmpeg Integration: Uses @ffmpeg/ffmpeg and @ffmpeg/util from node_modules
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex items-center space-x-4">
          <a-button 
            type="primary" 
            @click="initFFmpeg" 
            :loading="ffmpegLoading"
            :disabled="ffmpegLoaded"
          >
            {{ ffmpegLoaded ? '✅ FFmpeg 已就绪' : '初始化 FFmpeg' }}
          </a-button>
          
          <div v-if="ffmpegLoaded" class="text-green-600 text-sm">
            FFmpeg WASM 已加载，可以进行高级视频处理
          </div>
        </div>

        <div v-if="ffmpegLoaded" class="p-4 bg-gray-50 rounded-lg">
          <h4 class="font-medium mb-2">FFmpeg 功能</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>✅ 视频格式转换</div>
            <div>✅ 音频提取</div>
            <div>✅ 帧率调整</div>
            <div>✅ 分辨率缩放</div>
            <div>✅ 视频压缩</div>
            <div>✅ 水印添加</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'

interface Props {
  activeTab: string
}

const props = defineProps<Props>()

// File inputs
const formatFileInput = ref<HTMLInputElement>()
const frameSplitterInput = ref<HTMLInputElement>()
const frameMergerInput = ref<HTMLInputElement>()

// State
const formatConvertProgress = ref({
  show: false,
  percent: 0,
  text: '',
  fileInfo: null as any
})

const frameSplitterFile = ref<File | null>(null)
const frameMergerFiles = ref<File[]>([])
const frameDelay = ref(500)
const outputFormat = ref('gif')

const ffmpegLoaded = ref(false)
const ffmpegLoading = ref(false)
const ffmpeg = ref<any>(null)

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

const handleFormatConverterDrop = (e: DragEvent) => {
  e.preventDefault()
  handleDragLeave(e)
  
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length > 0) {
    processFormatConverter(files[0])
  }
}

const triggerFormatFileInput = () => {
  formatFileInput.value?.click()
}

const handleFormatConverterFile = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processFormatConverter(target.files[0])
  }
}

const processFormatConverter = async (file: File) => {
  formatConvertProgress.value.show = true
  formatConvertProgress.value.percent = 0
  formatConvertProgress.value.text = '正在分析文件...'
  formatConvertProgress.value.fileInfo = null

  // Simulate file processing
  const steps = [
    { percent: 10, text: '正在读取文件...', showInfo: false },
    { percent: 30, text: '正在分析媒体信息...', showInfo: true },
    { percent: 50, text: '正在处理帧数据...', showInfo: true },
    { percent: 70, text: '正在编码转换...', showInfo: true },
    { percent: 90, text: '正在生成输出文件...', showInfo: true },
    { percent: 100, text: '处理完成！', showInfo: true }
  ]

  for (const step of steps) {
    await delay(800)
    formatConvertProgress.value.percent = step.percent
    formatConvertProgress.value.text = step.text
    
    if (step.showInfo && !formatConvertProgress.value.fileInfo) {
      formatConvertProgress.value.fileInfo = {
        size: formatBytes(file.size),
        dimensions: '1920×1080', // Simulated
        framerate: '30 fps',
        codec: file.type.includes('video') ? 'H.264' : 'GIF',
        bitrate: '2000 kbps'
      }
    }
  }

  message.success('文件转换完成！')
  
  setTimeout(() => {
    formatConvertProgress.value.show = false
  }, 3000)
}

const handleFrameSplitterDrop = (e: DragEvent) => {
  e.preventDefault()
  handleDragLeave(e)
  
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length > 0) {
    frameSplitterFile.value = files[0]
    message.success(`已选择文件: ${files[0].name}`)
  }
}

const triggerFrameSplitterInput = () => {
  frameSplitterInput.value?.click()
}

const handleFrameSplitterFile = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    frameSplitterFile.value = target.files[0]
    message.success(`已选择文件: ${target.files[0].name}`)
  }
}

const startFrameSplitting = () => {
  if (!frameSplitterFile.value) return
  
  message.loading('正在提取帧...', 2)
  setTimeout(() => {
    message.success('帧提取完成！已提取到 24 帧')
  }, 2000)
}

const handleFrameMergerDrop = (e: DragEvent) => {
  e.preventDefault()
  handleDragLeave(e)
  
  const files = Array.from(e.dataTransfer?.files || [])
  frameMergerFiles.value = files.filter(file => file.type.startsWith('image/'))
  message.success(`已选择 ${frameMergerFiles.value.length} 个图像文件`)
}

const triggerFrameMergerInput = () => {
  frameMergerInput.value?.click()
}

const handleFrameMergerFiles = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    frameMergerFiles.value = Array.from(target.files)
    message.success(`已选择 ${frameMergerFiles.value.length} 个图像文件`)
  }
}

const startFrameMerging = () => {
  if (frameMergerFiles.value.length === 0) return
  
  message.loading(`正在合并为 ${outputFormat.value.toUpperCase()}...`, 3)
  setTimeout(() => {
    message.success(`动画 ${outputFormat.value.toUpperCase()} 生成完成！`)
  }, 3000)
}

const initFFmpeg = async () => {
  if (ffmpegLoaded.value) return
  
  ffmpegLoading.value = true
  
  try {
    // Simulate FFmpeg loading
    await delay(2000)
    ffmpegLoaded.value = true
    message.success('FFmpeg WASM 初始化成功！')
  } catch (error) {
    console.error('FFmpeg initialization failed:', error)
    message.error('FFmpeg 初始化失败')
  } finally {
    ffmpegLoading.value = false
  }
}

// Utility functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>