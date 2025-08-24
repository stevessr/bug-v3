<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string>('')
const isDragOver = ref(false)
const outputFormat = ref('gif')
const frameRate = ref(15)
const quality = ref('medium')
const isConverting = ref(false)
const progress = ref(0)
const convertedFile = ref<Blob | null>(null)

const metadata = ref<{
  mime?: string
  container?: string
  duration?: number
  durationDisplay?: string
  resolution?: string
  fps?: number
  fpsDisplay?: string
  note?: string
}>({
  mime: '',
  container: '',
  duration: 0,
  durationDisplay: '未知',
  resolution: '未知',
  fps: 0,
  fpsDisplay: '未知',
  note: ''
})

const isVideo = computed(() => {
  if (!selectedFile.value) return false
  return selectedFile.value.type.startsWith('video/')
})

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

const humanFileSize = (size: number) => {
  if (size === 0) return '0 B'
  const i = Math.floor(Math.log(size) / Math.log(1024))
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}

const formatSeconds = (s?: number) => {
  if (!s || !isFinite(s)) return '未知'
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, '0')
  const min = Math.floor((s / 60) % 60)
    .toString()
    .padStart(2, '0')
  const hrs = Math.floor(s / 3600)
  return hrs > 0 ? `${hrs}:${min}:${sec}` : `${min}:${sec}`
}

const handleFile = (file: File) => {
  // revoke previous preview if any
  if (previewUrl.value) {
    try {
      URL.revokeObjectURL(previewUrl.value)
    } catch {}
  }

  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  metadata.value = {
    mime: file.type || '',
    container: '',
    duration: 0,
    durationDisplay: '未知',
    resolution: '未知',
    fps: 0,
    fpsDisplay: '未知',
    note: ''
  }

  inspectFile(file).catch(e => {
    metadata.value.note = '读取元数据失败'
    console.warn('inspectFile failed', e)
  })
}

const clearFile = () => {
  selectedFile.value = null
  if (previewUrl.value) {
    try {
      URL.revokeObjectURL(previewUrl.value)
    } catch {}
  }
  previewUrl.value = ''
  convertedFile.value = null
  metadata.value = {
    mime: '',
    container: '',
    duration: 0,
    durationDisplay: '未知',
    resolution: '未知',
    fps: 0,
    fpsDisplay: '未知',
    note: ''
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function inspectFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!metadata.value) return
  metadata.value.mime = file.type || ''
  metadata.value.container = ext || ''

  // Images (including GIF)
  if (file.type.startsWith('image/') || ext === 'gif') {
    await new Promise<void>(resolve => {
      const img = new Image()
      img.onload = () => {
        metadata.value.resolution = `${img.naturalWidth}x${img.naturalHeight}`
        metadata.value.durationDisplay = ext === 'gif' ? '未知（GIF 动图）' : '-'
        if (ext === 'gif') metadata.value.note = 'GIF 动图 — 浏览器无法可靠提供帧率/时长信息'
        resolve()
      }
      img.onerror = () => resolve()
      img.src = previewUrl.value as string
    })
    return
  }

  // Videos
  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    const videoEl = document.createElement('video')
    videoEl.preload = 'metadata'
    videoEl.muted = true
    videoEl.playsInline = true
    videoEl.src = previewUrl.value as string

    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          metadata.value.duration = videoEl.duration || 0
          metadata.value.durationDisplay = formatSeconds(videoEl.duration)
          metadata.value.resolution = `${videoEl.videoWidth}x${videoEl.videoHeight}`
          resolve()
        }
        const onError = () => reject(new Error('video load error'))
        videoEl.addEventListener('loadedmetadata', onLoaded, { once: true })
        videoEl.addEventListener('error', onError, { once: true })
        // start loading
        videoEl.load()
      })

      // Try to estimate FPS using requestVideoFrameCallback if available
      if ((videoEl as any).requestVideoFrameCallback) {
        const timestamps: number[] = []
        const start = performance.now()
        await new Promise<void>(resolve => {
          let frames = 0
          const cb = (now: number) => {
            timestamps.push(now)
            frames++
            if (frames >= 8 || performance.now() - start > 1200) {
              resolve()
            } else {
              try {
                ;(videoEl as any).requestVideoFrameCallback(cb)
              } catch {
                resolve()
              }
            }
          }
          try {
            ;(videoEl as any).requestVideoFrameCallback(cb)
          } catch {
            resolve()
          }
          // ensure playback to trigger callbacks
          videoEl.play().catch(() => {})
        })

        if (timestamps.length >= 2) {
          const deltas: number[] = []
          for (let i = 1; i < timestamps.length; i++) deltas.push(timestamps[i] - timestamps[i - 1])
          const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
          metadata.value.fps = Math.round(1000 / avg)
          metadata.value.fpsDisplay = `${metadata.value.fps}`
        } else {
          metadata.value.fpsDisplay = '未知'
        }
      } else {
        metadata.value.fpsDisplay = '未知'
        metadata.value.note = '当前浏览器不支持 requestVideoFrameCallback，无法估算帧率'
      }
    } catch (e) {
      metadata.value.note = '无法读取视频元数据'
    }
    return
  }

  // Fallback unknown type
  metadata.value.note = '未知文件类型，无法读取更多信息'
}

const convertFile = async () => {
  if (!selectedFile.value) return

  isConverting.value = true
  progress.value = 0

  try {
    // 模拟转换进度
    const interval = setInterval(() => {
      progress.value += Math.random() * 15
      if (progress.value >= 95) {
        clearInterval(interval)
      }
    }, 200)

    // 模拟转换过程 (实际实现需要使用FFmpeg.js或类似库)
    await new Promise(resolve => setTimeout(resolve, 2000))

    clearInterval(interval)
    progress.value = 100

    // 模拟转换结果 (实际实现需要真正的转换逻辑)
    convertedFile.value = selectedFile.value
  } catch (error) {
    console.error('转换失败:', error)
  } finally {
    isConverting.value = false
  }
}

const downloadFile = () => {
  if (!convertedFile.value || !selectedFile.value) return

  const url = URL.createObjectURL(convertedFile.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `converted_${selectedFile.value.name.split('.')[0]}.${outputFormat.value}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onBeforeUnmount(() => {
  if (previewUrl.value) {
    try {
      URL.revokeObjectURL(previewUrl.value)
    } catch {}
  }
})

const openFileDialog = () => {
  if (fileInput.value) fileInput.value.click()
}
</script>
<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">格式转换</h2>
    <p class="text-gray-600 mb-6">将GIF、MP4、WebM等动图格式转换为APNG或GIF</p>

    <!-- File Upload Area -->
    <div
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent
      class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
      :class="[isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300']"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".gif,.mp4,.webm,.mov,.avi"
        @change="handleFileSelect"
        class="hidden"
      />

      <div v-if="!selectedFile">
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
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
        <p class="mt-2 text-sm text-gray-600">
          拖拽文件到这里或
          <button @click="openFileDialog" class="text-blue-600 hover:text-blue-500">
            点击选择文件
          </button>
        </p>
        <p class="text-xs text-gray-500 mt-1">支持 GIF, MP4, WebM, MOV, AVI 格式</p>
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-center justify-center">
          <video
            v-if="isVideo"
            :src="previewUrl"
            class="max-h-32 rounded"
            autoplay
            loop
            muted
          ></video>
          <img v-else :src="previewUrl" class="max-h-32 rounded" alt="预览" />
        </div>
        <p class="text-sm text-gray-600">{{ selectedFile.name }}</p>
        <button @click="clearFile" class="text-red-600 hover:text-red-500 text-sm">移除文件</button>
      </div>
    </div>

    <!-- File Metadata -->
    <div
      v-if="selectedFile"
      class="mt-4 bg-gray-50 border border-gray-100 rounded p-4 text-sm text-gray-700"
    >
      <h4 class="font-medium text-gray-900 mb-2">文件信息</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          文件名:
          <span class="text-gray-600">{{ selectedFile.name }}</span>
        </div>
        <div>
          类型 (MIME):
          <span class="text-gray-600">{{ metadata.mime || selectedFile.type || '未知' }}</span>
        </div>
        <div>
          大小:
          <span class="text-gray-600">{{ humanFileSize(selectedFile.size) }}</span>
        </div>
        <div>
          编码/容器:
          <span class="text-gray-600">{{ metadata.container || '未知' }}</span>
        </div>
        <div>
          时长:
          <span class="text-gray-600">{{ metadata.durationDisplay }}</span>
        </div>
        <div>
          分辨率:
          <span class="text-gray-600">{{ metadata.resolution }}</span>
        </div>
        <div>
          估计帧率 (FPS):
          <span class="text-gray-600">{{ metadata.fpsDisplay }}</span>
        </div>
      </div>
      <div v-if="metadata.note" class="mt-2 text-xs text-gray-500">{{ metadata.note }}</div>
    </div>

    <!-- Conversion Options -->
    <div v-if="selectedFile" class="mt-6 space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">输出格式</label>
        <select
          v-model="outputFormat"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="gif">GIF</option>
          <option value="apng">APNG</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">帧率 (FPS)</label>
          <input
            v-model.number="frameRate"
            type="number"
            min="1"
            max="60"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">质量</label>
          <select
            v-model="quality"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low">低质量 (文件更小)</option>
            <option value="medium">中等质量</option>
            <option value="high">高质量 (文件更大)</option>
          </select>
        </div>
      </div>

      <!-- Convert Button -->
      <button
        @click="convertFile"
        :disabled="isConverting"
        class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span v-if="isConverting">转换中...</span>
        <span v-else>开始转换</span>
      </button>
    </div>

    <!-- Conversion Progress -->
    <div v-if="isConverting" class="mt-4">
      <div class="bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <p class="text-sm text-gray-600 mt-2 text-center">{{ progress }}%</p>
    </div>

    <!-- Download Result -->
    <div v-if="convertedFile" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-green-800">转换完成!</h3>
          <p class="text-sm text-green-600">文件已准备好下载</p>
        </div>
        <button
          @click="downloadFile"
          class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          下载文件
        </button>
      </div>
    </div>
  </div>
</template>
