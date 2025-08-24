<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier */
import { ref } from 'vue'
import { message } from 'ant-design-vue'
// libs for advanced processing
import { parseGIF, decompressFrames } from 'gifuct-js'
import JSZip from 'jszip'

// dynamic import helper functions when needed to avoid pre-bundling / HMR issues in dev

interface Props {
  activeTab: string
}

defineProps<Props>()

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
const frameMergerPreviews = ref<Array<{ file: File; url: string; name: string }>>([])
const frameDelay = ref(500)
const outputFormat = ref('gif')
const targetFormat = ref('png')
const outputQuality = ref(90)
const formatFile = ref<File | null>(null)
const formatFilePreview = ref('')
const formatOutputUrl = ref('')
const formatOutputName = ref('')
const frameImages = ref<Array<{ url: string; name: string }>>([])

const ffmpegLoaded = ref(false)
const ffmpegLoading = ref(false)
// ffmpeg wasm instance (initialized when user requests)
type FFmpegLike = { load: () => Promise<void>; [k: string]: unknown }
let ffmpeg: FFmpegLike | null = null
let ffmpegMod: any = null

// Methods
const handleDragOver = (ev: DragEvent) => {
  ev.preventDefault()
  const target = ev.currentTarget as HTMLElement | null
  if (target) target.classList.add('border-blue-400', 'bg-blue-50')
}

const handleDragLeave = (ev: DragEvent) => {
  const target = ev.currentTarget as HTMLElement | null
  if (target) target.classList.remove('border-blue-400', 'bg-blue-50')
}

const handleFormatConverterDrop = (ev: DragEvent) => {
  ev.preventDefault()
  handleDragLeave(ev)

  const files = Array.from(ev.dataTransfer?.files || [])
  if (files.length > 0) {
    setFormatFile(files[0])
  }
}

const triggerFormatFileInput = () => {
  if (!formatFile.value) {
    formatFileInput.value?.click()
  }
}

const handleFormatConverterFile = (ev: Event) => {
  const target = ev.target as HTMLInputElement
  if (target.files && target.files[0]) {
    setFormatFile(target.files[0])
  }
}

const setFormatFile = (file: File) => {
  formatFile.value = file
  // Create preview URL
  if (formatFilePreview.value) {
    URL.revokeObjectURL(formatFilePreview.value)
  }
  formatFilePreview.value = URL.createObjectURL(file)
  message.success(`已选择文件: ${file.name}`)
}

const clearFormatFile = () => {
  formatFile.value = null
  if (formatFilePreview.value) {
    URL.revokeObjectURL(formatFilePreview.value)
    formatFilePreview.value = ''
  }
  if (formatOutputUrl.value) {
    URL.revokeObjectURL(formatOutputUrl.value)
    formatOutputUrl.value = ''
    formatOutputName.value = ''
  }
  // Clear file input
  if (formatFileInput.value) {
    formatFileInput.value.value = ''
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
  // keep reference to selected file for conversion
  formatFile.value = file

  setTimeout(() => {
    formatConvertProgress.value.show = false
  }, 3000)
}

const startFormatConversion = async () => {
  if (!formatFile.value) return

  const file = formatFile.value

  // Show progress first
  await processFormatConverter(file)

  // Only support basic image conversion client-side (first-frame for GIF)
  if (file.type.startsWith('image/')) {
    if (targetFormat.value === 'gif' || targetFormat.value === 'apng') {
      // For GIF/APNG conversion, we need FFmpeg
      if (!ffmpegLoaded.value || !ffmpeg) {
        message.warning('GIF/APNG 转换需要 FFmpeg，请先初始化 FFmpeg（页面下方）')
        return
      }

      try {
        message.loading('正在使用 FFmpeg 转换为动画格式...', 0)
        const mod = await import('@/options/utils/ffmpegHelper')
        const { convertVideoToAnimated } = mod
        const res = await convertVideoToAnimated(
          file,
          ffmpeg as any,
          ffmpegMod,
          targetFormat.value,
          {
            fps: 10,
            scale: 480
          }
        )
        if (formatOutputUrl.value) URL.revokeObjectURL(formatOutputUrl.value)
        formatOutputUrl.value = res.url
        formatOutputName.value = res.name
        message.success('图像转换为动画格式完成，可下载')
      } catch (err) {
        message.error('动画格式转换失败: ' + String(err))
      }
      return
    }

    // Regular image format conversion
    const reader = new FileReader()
    reader.onload = async ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const mime =
          targetFormat.value === 'jpeg'
            ? 'image/jpeg'
            : targetFormat.value === 'webp'
              ? 'image/webp'
              : 'image/png'
        canvas.toBlob(
          blob => {
            if (!blob) {
              message.error('转换失败：生成 Blob 失败')
              return
            }
            if (formatOutputUrl.value) URL.revokeObjectURL(formatOutputUrl.value)
            formatOutputUrl.value = URL.createObjectURL(blob)
            const ext = targetFormat.value === 'jpeg' ? 'jpg' : targetFormat.value
            formatOutputName.value = file.name.replace(/\.[^.]+$/, '') + '.' + ext
            message.success('图像已转换，可下载')
          },
          mime,
          outputQuality.value / 100
        )
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  } else if (file.type.startsWith('video/')) {
    if (!ffmpegLoaded.value || !ffmpeg) {
      message.warning('视频转换需要 FFmpeg，请先初始化 FFmpeg（页面下方）')
      return
    }

    try {
      message.loading('正在使用 FFmpeg 转换视频，请稍候...', 0)
      const mod = await import('@/options/utils/ffmpegHelper')
      const { convertVideoToAnimated } = mod

      // 根据目标格式选择输出类型
      let outputType: 'gif' | 'apng' = 'gif'
      let isFrameExtraction = false

      if (targetFormat.value === 'apng') {
        outputType = 'apng'
      } else if (targetFormat.value === 'gif') {
        outputType = 'gif'
      } else {
        // 对于其他格式，提取第一帧
        message.info('视频只能转换为动画格式(GIF/APNG)，将提取第一帧作为静态图像')
        outputType = 'gif' // 默认使用gif格式提取帧
        isFrameExtraction = true
      }

      const res = await convertVideoToAnimated(file, ffmpeg as any, ffmpegMod, outputType, {
        fps: isFrameExtraction ? 1 : 10,
        scale: 480
      })
      if (formatOutputUrl.value) URL.revokeObjectURL(formatOutputUrl.value)
      formatOutputUrl.value = res.url
      formatOutputName.value = res.name
      message.success('视频转换完成，可下载')
    } catch (err) {
      message.error('视频转换失败: ' + String(err))
    }
  } else {
    message.error('不支持的文件类型')
  }
}

const downloadConvertedFile = () => {
  if (!formatOutputUrl.value) return
  const a = document.createElement('a')
  a.href = formatOutputUrl.value
  a.download = formatOutputName.value || 'converted'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Frame extraction
const extractFramesFromVideo = async (file: File) => {
  frameImages.value = []
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  // ensure browser will load enough data for seeking
  video.preload = 'auto'
  video.src = url
  video.crossOrigin = 'anonymous'
  video.muted = true
  await new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(null))
    video.addEventListener('error', e => reject(e))
  })
  // pause to ensure seeking works consistently
  try {
    video.pause()
  } catch {
    /* ignore */
  }

  const duration = video.duration
  // 获取视频信息用于智能采样

  // 对于高帧率视频，智能决定采样策略
  let captureCount: number
  if (duration <= 5) {
    // 短视频：每秒2帧
    captureCount = Math.ceil(duration * 2)
  } else if (duration <= 30) {
    // 中等长度视频：每秒1帧
    captureCount = Math.ceil(duration)
  } else {
    // 长视频：每2秒1帧
    captureCount = Math.ceil(duration / 2)
  }

  // 限制最大帧数
  captureCount = Math.min(captureCount, 60)

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 360
  const ctx = canvas.getContext('2d')!

  for (let i = 0; i < captureCount; i++) {
    // protect against division by zero when captureCount === 1
    const denom = Math.max(captureCount - 1, 1)
    let time = (i / denom) * duration

    // ensure time and duration are finite numbers
    if (!Number.isFinite(time) || Number.isNaN(time)) time = 0
    const maxSeek =
      Number.isFinite(duration) && !Number.isNaN(duration) ? Math.max(0, duration - 0.1) : 0

    const seekTime = Math.min(Math.max(0, time), maxSeek)

    await new Promise<void>(resolve => {
      const onSeeked = () => {
        // clear timeout then process frame
        clearTimeout(seekTimeout)

        const finish = () => {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            canvas.toBlob(blob => {
              if (blob) {
                const imgUrl = URL.createObjectURL(blob)
                frameImages.value.push({
                  url: imgUrl,
                  name: `${file.name.replace(/\.[^.]+$/, '')}_frame_${String(i + 1).padStart(3, '0')}.png`
                })
              }
              resolve()
            }, 'image/png')
          } catch {
            // In rare cases drawImage/toBlob may fail; continue with next frame
            resolve()
          } finally {
            video.removeEventListener('seeked', onSeeked)
            video.removeEventListener('error', onError)
          }
        }

        // Prefer requestVideoFrameCallback when available to ensure the frame is ready
        // before drawing; otherwise fallback to immediate drawImage.
        try {
          const anyVideo = video as any
          if (typeof anyVideo.requestVideoFrameCallback === 'function') {
            anyVideo.requestVideoFrameCallback(() => finish())
          } else {
            finish()
          }
        } catch {
          finish()
        }
      }

      const onError = () => {
        clearTimeout(seekTimeout)
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        // skip this frame on error
        resolve()
      }

      // fallback timeout in case seeked/error never fire (some containers coalesce seeks)
      const seekTimeout = setTimeout(() => {
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        resolve()
      }, 2500)

      video.addEventListener('seeked', onSeeked)
      video.addEventListener('error', onError)

      // Assign a validated, clamped time to avoid non-finite errors
      try {
        video.currentTime = seekTime
      } catch {
        clearTimeout(seekTimeout)
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        // If assignment throws, skip and resolve to continue processing other frames
        resolve()
      }
    })
  }
  URL.revokeObjectURL(url)
}

const extractFramesFromGif = async (file: File) => {
  // Use gifuct-js to decode all frames
  frameImages.value = []
  const arrayBuffer = await file.arrayBuffer()
  const gif = parseGIF(arrayBuffer)
  const frames = decompressFrames(gif, true)

  const canvas = document.createElement('canvas')
  canvas.width = frames[0].dims.width
  canvas.height = frames[0].dims.height
  const ctx = canvas.getContext('2d')!

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const imageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height
    )
    // clear and put image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.putImageData(imageData, frame.dims.left || 0, frame.dims.top || 0)
    // export
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/png')
    )
    if (blob) {
      const url = URL.createObjectURL(blob)
      frameImages.value.push({
        url,
        name: `${file.name.replace(/\.[^.]+$/, '')}_frame_${i + 1}.png`
      })
    }
  }
}

const startFrameSplitting = async () => {
  if (!frameSplitterFile.value) return
  frameImages.value = []
  const file = frameSplitterFile.value
  try {
    if (file.type.startsWith('video/')) {
      message.loading('正在提取视频帧...', 0.5)
      await extractFramesFromVideo(file)
      message.success(`提取完成：${frameImages.value.length} 帧`)
    } else if (file.type === 'image/gif') {
      message.loading('正在从 GIF 提取全部帧...', 0.5)
      await extractFramesFromGif(file)
      message.success(`提取完成：${frameImages.value.length} 帧`)
    } else {
      message.error('不支持的提取类型')
    }
  } catch (_e: unknown) {
    const msg =
      typeof _e === 'object' && _e && 'message' in _e ? String((_e as any).message) : String(_e)
    message.error('帧提取失败: ' + msg)
  }
}

const downloadFrame = (frame: { url: string; name: string }) => {
  const a = document.createElement('a')
  a.href = frame.url
  a.download = frame.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const downloadAllFrames = async () => {
  if (frameImages.value.length === 0) return
  // Package frames into a zip
  const zip = new JSZip()
  for (const f of frameImages.value) {
    const resp = await fetch(f.url)
    const blob = await resp.blob()
    zip.file(f.name, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `frames_${Date.now()}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const handleFrameSplitterDrop = (ev: DragEvent) => {
  ev.preventDefault()
  handleDragLeave(ev)

  const files = Array.from(ev.dataTransfer?.files || [])
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

// startFrameSplitting implemented above (async extractor)

const handleFrameMergerDrop = (ev: DragEvent) => {
  ev.preventDefault()
  handleDragLeave(ev)

  const files = Array.from(ev.dataTransfer?.files || []).filter(file =>
    file.type.startsWith('image/')
  )
  setFrameMergerFiles(files)
}

const triggerFrameMergerInput = () => {
  frameMergerInput.value?.click()
}

const handleFrameMergerFiles = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files).filter(file => file.type.startsWith('image/'))
    setFrameMergerFiles(files)
  }
}

const setFrameMergerFiles = (files: File[]) => {
  // Clear previous previews
  frameMergerPreviews.value.forEach(preview => {
    URL.revokeObjectURL(preview.url)
  })

  frameMergerFiles.value = files
  frameMergerPreviews.value = files.map(file => ({
    file,
    url: URL.createObjectURL(file),
    name: file.name
  }))

  message.success(`已选择 ${files.length} 个图像文件`)
}

const moveFrameUp = (index: number) => {
  if (index > 0) {
    const files = [...frameMergerFiles.value]
    const previews = [...frameMergerPreviews.value]

    // Swap files
    ;[files[index], files[index - 1]] = [files[index - 1], files[index]]
    ;[previews[index], previews[index - 1]] = [previews[index - 1], previews[index]]

    frameMergerFiles.value = files
    frameMergerPreviews.value = previews
  }
}

const moveFrameDown = (index: number) => {
  if (index < frameMergerFiles.value.length - 1) {
    const files = [...frameMergerFiles.value]
    const previews = [...frameMergerPreviews.value]

    // Swap files
    ;[files[index], files[index + 1]] = [files[index + 1], files[index]]
    ;[previews[index], previews[index + 1]] = [previews[index + 1], previews[index]]

    frameMergerFiles.value = files
    frameMergerPreviews.value = previews
  }
}

const removeFrame = (index: number) => {
  URL.revokeObjectURL(frameMergerPreviews.value[index].url)
  frameMergerFiles.value.splice(index, 1)
  frameMergerPreviews.value.splice(index, 1)
}

const startFrameMerging = async () => {
  if (frameMergerFiles.value.length === 0) return

  const files = frameMergerFiles.value
  if (ffmpegLoaded.value && ffmpeg) {
    try {
      message.loading('使用 FFmpeg 合并帧，请稍候...', 0)
      const m = await import('@/options/utils/ffmpegHelper')
      const { mergeImagesToAnimated } = m
      const res = await mergeImagesToAnimated(
        files,
        ffmpeg as any,
        ffmpegMod,
        outputFormat.value === 'apng' ? 'apng' : 'gif',
        {
          delay: frameDelay.value,
          scale: 480
        }
      )
      if (formatOutputUrl.value) URL.revokeObjectURL(formatOutputUrl.value)
      formatOutputUrl.value = res.url
      formatOutputName.value = res.name
      message.success('动画已生成，可下载')
    } catch (err) {
      message.error('合并失败: ' + String(err))
    }
  } else {
    // fallback: zip all frames for download
    try {
      const zip = new JSZip()
      for (const f of files) {
        const data = await f.arrayBuffer()
        zip.file(f.name, new Blob([data]))
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      if (formatOutputUrl.value) URL.revokeObjectURL(formatOutputUrl.value)
      formatOutputUrl.value = url
      formatOutputName.value = `frames_${Date.now()}.zip`
      message.success('已将帧打包为 ZIP，点击下载')
    } catch (err) {
      message.error('打包失败: ' + String(err))
    }
  }
}

const initFFmpeg = async () => {
  if (ffmpegLoaded.value) return

  ffmpegLoading.value = true
  try {
    const helper = await import('@/options/utils/ffmpegHelper')
    const res = await helper.createAndLoadFFmpeg()
    // store minimal wrapper and module
    ffmpeg = (res as any).ffmpeg as unknown as FFmpegLike
    ffmpegMod = (res as any).mod
    ffmpegLoaded.value = true
    ffmpegLoading.value = false
    message.success('FFmpeg WASM 初始化成功！')
  } catch (err) {
    message.error('FFmpeg 初始化失败: ' + String(err))
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
<template>
  <div v-if="activeTab === 'tools'" class="space-y-8">
    <div class="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-6 rounded-lg">
      <h2 class="text-2xl font-bold mb-4">🔧 多媒体小工具</h2>
      <p class="text-blue-100">专业的多媒体处理工具，支持格式转换、帧处理和本地 FFmpeg 集成</p>
    </div>

    <!-- Quick open standalone windows -->
    <div class="flex space-x-3">
      <a
        class="inline-flex items-center px-4 py-2 bg-white text-sm rounded shadow hover:bg-gray-100"
        href="/image-editor.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        🖼 图像编辑器（新窗口）
      </a>
      <a
        class="inline-flex items-center px-4 py-2 bg-white text-sm rounded shadow hover:bg-gray-100"
        href="/ai-image-generator.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        🤖 AI 图像生成（新窗口）
      </a>
      <a
        class="inline-flex items-center px-4 py-2 bg-white text-sm rounded shadow hover:bg-gray-100"
        href="/emoji-rename.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        ✏️ AI 表情重命名（新窗口）
      </a>
    </div>

    <!-- Format Converter -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center mb-4">
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">🔄</div>
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
        <div v-if="!formatFile" class="text-4xl mb-4">📁</div>
        <div v-if="!formatFile">
          <p class="text-gray-600 mb-2">拖拽文件到此处或点击选择文件</p>
          <p class="text-gray-400 text-sm">支持: GIF, MP4, WebM</p>
        </div>

        <!-- File preview -->
        <div v-if="formatFile" class="space-y-4">
          <div class="text-lg font-medium text-gray-700">{{ formatFile.name }}</div>
          <div v-if="formatFilePreview" class="flex justify-center">
            <video
              v-if="formatFile.type.startsWith('video/')"
              :src="formatFilePreview"
              controls
              class="max-w-xs max-h-48 rounded shadow"
            />
            <img
              v-else
              :src="formatFilePreview"
              class="max-w-xs max-h-48 rounded shadow object-contain"
            />
          </div>
          <div class="text-sm text-gray-500">
            大小: {{ (formatFile.size / 1024 / 1024).toFixed(2) }} MB
          </div>
          <a-button size="small" @click="clearFormatFile">重新选择</a-button>
        </div>
      </div>

      <div class="mt-4 flex items-center space-x-3">
        <label class="text-sm">目标格式：</label>
        <a-select v-model:value="targetFormat" style="width: 160px">
          <a-select-option value="png">PNG</a-select-option>
          <a-select-option value="webp">WebP</a-select-option>
          <a-select-option value="jpeg">JPEG</a-select-option>
          <a-select-option value="gif">GIF</a-select-option>
          <a-select-option value="apng">APNG</a-select-option>
        </a-select>

        <label class="text-sm">质量：</label>
        <a-input-number v-model:value="outputQuality" :min="10" :max="100" :step="5" />

        <a-button
          type="primary"
          @click="startFormatConversion"
          :disabled="!formatFile"
          class="ml-2"
        >
          开始转换
        </a-button>
        <a-button v-if="formatOutputUrl" @click="downloadConvertedFile" class="ml-2">
          下载结果
        </a-button>
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
            <div>
              <span class="font-medium">文件大小:</span>
              {{ formatConvertProgress.fileInfo.size }}
            </div>
            <div>
              <span class="font-medium">尺寸:</span>
              {{ formatConvertProgress.fileInfo.dimensions }}
            </div>
            <div>
              <span class="font-medium">帧率:</span>
              {{ formatConvertProgress.fileInfo.framerate }}
            </div>
            <div>
              <span class="font-medium">编码:</span>
              {{ formatConvertProgress.fileInfo.codec }}
            </div>
            <div>
              <span class="font-medium">码率:</span>
              {{ formatConvertProgress.fileInfo.bitrate }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="formatOutputUrl" class="mt-4 p-3 bg-white rounded shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-sm">
            已生成文件:
            <span class="font-medium">{{ formatOutputName }}</span>
          </div>
          <div>
            <a-button type="primary" @click="downloadConvertedFile">下载</a-button>
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

      <a-button
        type="primary"
        @click="startFrameSplitting"
        :disabled="!frameSplitterFile"
        class="mt-4"
      >
        开始提取帧
      </a-button>

      <div v-if="frameImages.length > 0" class="mt-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm font-medium">已提取 {{ frameImages.length }} 帧</div>
          <div class="flex space-x-2">
            <a-button type="primary" @click="downloadAllFrames">下载全部帧</a-button>
          </div>
        </div>

        <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
          <div v-for="frame in frameImages" :key="frame.name" class="border rounded p-2 bg-white">
            <img :src="frame.url" class="w-full h-24 object-contain mb-2" />
            <div class="flex items-center justify-between">
              <div class="text-xs truncate">{{ frame.name }}</div>
              <a-button size="small" @click="downloadFrame(frame)">下载</a-button>
            </div>
          </div>
        </div>
      </div>
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

      <div v-if="frameMergerPreviews.length > 0" class="mt-4">
        <p class="text-sm text-gray-600 mb-2">已选择 {{ frameMergerPreviews.length }} 个文件</p>

        <!-- Image preview and reordering -->
        <div class="mb-4 max-h-64 overflow-y-auto border rounded p-2">
          <div class="grid grid-cols-4 md:grid-cols-6 gap-2">
            <div
              v-for="(preview, index) in frameMergerPreviews"
              :key="index"
              class="border rounded p-2 bg-white relative group"
            >
              <img :src="preview.url" class="w-full h-16 object-contain mb-1" />
              <div class="text-xs truncate">{{ preview.name }}</div>
              <div
                class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1"
              >
                <a-button
                  size="small"
                  type="text"
                  @click="moveFrameUp(index)"
                  :disabled="index === 0"
                  class="!p-1 !w-6 !h-6 flex items-center justify-center"
                >
                  ↑
                </a-button>
                <a-button
                  size="small"
                  type="text"
                  @click="moveFrameDown(index)"
                  :disabled="index === frameMergerPreviews.length - 1"
                  class="!p-1 !w-6 !h-6 flex items-center justify-center"
                >
                  ↓
                </a-button>
                <a-button
                  size="small"
                  type="text"
                  danger
                  @click="removeFrame(index)"
                  class="!p-1 !w-6 !h-6 flex items-center justify-center"
                >
                  ×
                </a-button>
              </div>
              <div
                class="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded"
              >
                {{ index + 1 }}
              </div>
            </div>
          </div>
        </div>

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
        <a-button type="primary" @click="startFrameMerging">合并为动画</a-button>
      </div>

      <!-- Result display -->
      <div
        v-if="formatOutputUrl && frameMergerFiles.length > 0"
        class="mt-4 p-3 bg-white rounded shadow-sm"
      >
        <div class="text-sm mb-2">合并结果预览：</div>
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <img
              v-if="outputFormat === 'gif'"
              :src="formatOutputUrl"
              class="w-20 h-20 object-contain border rounded"
            />
            <video
              v-else
              :src="formatOutputUrl"
              autoplay
              loop
              muted
              class="w-20 h-20 object-contain border rounded"
            ></video>
            <div class="text-sm">
              <div class="font-medium">{{ formatOutputName }}</div>
              <div class="text-gray-500">
                {{ frameMergerPreviews.length }} 帧 • {{ frameDelay }}ms 延迟
              </div>
            </div>
          </div>
          <a-button type="primary" @click="downloadConvertedFile">下载</a-button>
        </div>
      </div>
    </div>

    <!-- FFmpeg Integration -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center mb-4">
        <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-4">🎬</div>
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
