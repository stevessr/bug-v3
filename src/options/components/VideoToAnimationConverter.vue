<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  ScissorOutlined,
  StopOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'

import {
  getOutputFormatMeta,
  isGifInput,
  MAX_VIDEO_INPUT_BYTES,
  VIDEO_ANIMATION_PRESETS,
  type AnimationOutputFormat,
  type GifPaletteProfile,
  type VideoAnimationPresetId,
  type VideoConvertProgress
} from '@/utils/video/videoAnimationArgs'
import type { VideoConvertResult, VideoMetadata } from '@/utils/video/videoToAnimationService'

let videoServicePromise: Promise<typeof import('@/utils/video/videoToAnimationService')> | null =
  null
const loadVideoService = () => {
  if (!videoServicePromise) {
    videoServicePromise = import('@/utils/video/videoToAnimationService').catch(err => {
      videoServicePromise = null
      throw err
    })
  }
  return videoServicePromise
}

interface SourceVideoItem {
  id: string
  file: File
  previewUrl: string
  isGif: boolean
  previewError?: boolean
  status: 'idle' | 'converting' | 'done' | 'error'
  statusError?: string
  metadata: VideoMetadata | null
  metadataError?: string
}

interface ConvertedAnimationItem {
  id: string
  result: VideoConvertResult
  previewUrl: string
}

const emit = defineEmits<{
  (e: 'addToUpload', files: File[]): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const videoUrlInput = ref('')
const isFetchingUrl = ref(false)

const sourceVideos = ref<SourceVideoItem[]>([])
const activeSourceId = ref('')
const convertedItems = ref<ConvertedAnimationItem[]>([])

const activePreset = ref<VideoAnimationPresetId | 'custom'>('emoji')
const outputFormat = ref<AnimationOutputFormat>('gif')
const fps = ref<number>(VIDEO_ANIMATION_PRESETS.emoji.fps)
const maxWidth = ref<number>(VIDEO_ANIMATION_PRESETS.emoji.maxWidth)
const quality = ref<number>(VIDEO_ANIMATION_PRESETS.emoji.quality)
const startTime = ref<number | undefined>(undefined)
const clipDuration = ref<number | undefined>(undefined)
const gifProfile = ref<GifPaletteProfile>('high')
const webpLossless = ref(false)

const isConverting = ref(false)
const convertProgress = ref<VideoConvertProgress>({
  percent: 0,
  stage: '',
  message: ''
})
const batchStatusText = ref('')
const errorMessage = ref('')

let isUnmounted = false
let activeAbortController: AbortController | null = null
let urlFetchAbortController: AbortController | null = null
let metadataAbortController: AbortController | null = new AbortController()

const activeSource = computed(
  () => sourceVideos.value.find(item => item.id === activeSourceId.value) ?? sourceVideos.value[0]
)

const showAvifDurationWarning = computed(() => {
  if (outputFormat.value !== 'avif') return false
  const dur = activeSource.value?.metadata?.duration ?? 0
  const effectiveClip =
    typeof clipDuration.value === 'number' &&
    Number.isFinite(clipDuration.value) &&
    clipDuration.value > 0
      ? clipDuration.value
      : dur
  return effectiveClip > 15
})

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || !Number.isFinite(seconds)) return '未知'
  return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`
}

const formatSizeDelta = (result: VideoConvertResult): string => {
  if (!result.inputSize) return ''
  const ratio = ((result.size - result.inputSize) / result.inputSize) * 100
  const prefix = ratio > 0 ? '+' : ''
  return `${prefix}${ratio.toFixed(0)}%`
}

const applyPreset = (presetId: VideoAnimationPresetId) => {
  const preset = VIDEO_ANIMATION_PRESETS[presetId]
  activePreset.value = presetId
  fps.value = preset.fps
  maxWidth.value = preset.maxWidth
  quality.value = preset.quality
}

const markCustomPreset = () => {
  activePreset.value = 'custom'
}

const formatDescription = computed(() => {
  switch (outputFormat.value) {
    case 'gif':
      return '使用 FFmpeg 两步调色板优化（palettegen + paletteuse），全平台兼容性最好。'
    case 'apng':
      return '无损/高色彩透明通道动图，文件保存为 .png 扩展名以兼容各大论坛上传。'
    case 'webp':
      return 'libwebp_anim 动图编码，同等画质下体积通常显著小于 GIF 与 APNG。'
    case 'avif':
      return '基于本地 AVIF WASM 编码序列帧，体积最小，暂不保留透明通道。'
    default:
      return ''
  }
})

const updateSourceItem = (id: string, patch: Partial<SourceVideoItem>) => {
  const target = sourceVideos.value.find(item => item.id === id)
  if (target) {
    Object.assign(target, patch)
  }
}

const addSourceFiles = async (files: File[]) => {
  if (!files.length || isUnmounted) return
  errorMessage.value = ''

  const accepted: SourceVideoItem[] = []
  let emptyCount = 0
  let oversizedCount = 0

  for (const file of files) {
    const lower = file.name.toLowerCase()
    const isSupported =
      file.type.startsWith('video/') ||
      file.type === 'image/gif' ||
      /\.(mp4|webm|mov|mkv|m4v|ogv|gif)$/i.test(lower)
    if (!isSupported) continue

    if (file.size <= 0) {
      emptyCount++
      continue
    }
    if (file.size > MAX_VIDEO_INPUT_BYTES) {
      oversizedCount++
      continue
    }

    const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const previewUrl = URL.createObjectURL(file)
    const entry: SourceVideoItem = {
      id,
      file,
      previewUrl,
      isGif: isGifInput(file.name, file.type),
      status: 'idle',
      metadata: null
    }
    accepted.push(entry)
  }

  if (emptyCount > 0) {
    message.warning(`已跳过 ${emptyCount} 个空文件`)
  }
  if (oversizedCount > 0) {
    const maxMb = Math.round(MAX_VIDEO_INPUT_BYTES / 1024 / 1024)
    message.warning(`已跳过 ${oversizedCount} 个超过 ${maxMb} MB 限制的视频文件`)
  }

  if (accepted.length === 0) {
    if (emptyCount === 0 && oversizedCount === 0) {
      message.warning('未检测到支持的视频文件（支持 MP4、WebM、MOV、MKV、M4V、OGV、GIF）')
    }
    return
  }

  if (isUnmounted) {
    for (const item of accepted) URL.revokeObjectURL(item.previewUrl)
    return
  }

  sourceVideos.value = [...sourceVideos.value, ...accepted]
  if (!activeSourceId.value) {
    activeSourceId.value = accepted[0].id
  }

  try {
    const { probeVideoMetadata } = await loadVideoService()
    if (isUnmounted) return

    await Promise.all(
      accepted.map(async entry => {
        try {
          const metadata = await probeVideoMetadata(entry.file, {
            signal: metadataAbortController?.signal
          })
          if (!isUnmounted) {
            updateSourceItem(entry.id, { metadata, metadataError: undefined })
          }
        } catch (err) {
          if (isUnmounted || (err instanceof DOMException && err.name === 'AbortError')) return
          updateSourceItem(entry.id, {
            metadataError: err instanceof Error ? err.message : '读取元数据失败'
          })
        }
      })
    )
  } catch (err) {
    if (!isUnmounted) {
      const msg = err instanceof Error ? err.message : '加载视频解析模块失败'
      errorMessage.value = msg
    }
  }
}

const handleFileInputChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  await addSourceFiles(files)
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isDragOver.value = false
  if (isConverting.value) return
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  await addSourceFiles(files)
}

const cancelUrlFetch = () => {
  urlFetchAbortController?.abort(new DOMException('用户取消下载视频', 'AbortError'))
}

const handleLoadFromUrl = async () => {
  if (isFetchingUrl.value || isUnmounted) return
  const url = videoUrlInput.value.trim()
  if (!url) {
    message.warning('请输入视频链接')
    return
  }

  isFetchingUrl.value = true
  errorMessage.value = ''
  urlFetchAbortController = new AbortController()
  const signal = urlFetchAbortController.signal

  try {
    const { fetchVideoFromUrl } = await loadVideoService()
    const file = await fetchVideoFromUrl(url, { signal })
    if (isUnmounted) return
    await addSourceFiles([file])
    videoUrlInput.value = ''
    message.success(`已加载视频：${file.name}`)
  } catch (err) {
    if (isUnmounted) return
    if (err instanceof DOMException && err.name === 'AbortError') {
      message.info('已取消下载视频')
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      errorMessage.value = msg
      message.error(msg)
    }
  } finally {
    isFetchingUrl.value = false
    urlFetchAbortController = null
  }
}

const removeSourceVideo = (id: string) => {
  const target = sourceVideos.value.find(item => item.id === id)
  if (target) {
    URL.revokeObjectURL(target.previewUrl)
  }
  sourceVideos.value = sourceVideos.value.filter(item => item.id !== id)
  if (activeSourceId.value === id) {
    activeSourceId.value = sourceVideos.value[0]?.id || ''
  }
}

const clearSources = () => {
  for (const item of sourceVideos.value) {
    URL.revokeObjectURL(item.previewUrl)
  }
  sourceVideos.value = []
  activeSourceId.value = ''
}

const removeConvertedItem = (id: string) => {
  const target = convertedItems.value.find(item => item.id === id)
  if (target) {
    URL.revokeObjectURL(target.previewUrl)
  }
  convertedItems.value = convertedItems.value.filter(item => item.id !== id)
}

const clearResults = () => {
  for (const item of convertedItems.value) {
    URL.revokeObjectURL(item.previewUrl)
  }
  convertedItems.value = []
}

const startConversion = async () => {
  if (!sourceVideos.value.length || isConverting.value || isUnmounted) return

  isConverting.value = true
  errorMessage.value = ''
  activeAbortController = new AbortController()
  const signal = activeAbortController.signal

  const targets = [...sourceVideos.value]
  for (const item of targets) {
    updateSourceItem(item.id, { status: 'idle', statusError: undefined })
  }

  const normalizedFps =
    typeof fps.value === 'number' && Number.isFinite(fps.value)
      ? fps.value
      : VIDEO_ANIMATION_PRESETS.emoji.fps
  const normalizedMaxWidth =
    typeof maxWidth.value === 'number' && Number.isFinite(maxWidth.value) ? maxWidth.value : 0
  const normalizedQuality =
    typeof quality.value === 'number' && Number.isFinite(quality.value)
      ? quality.value
      : VIDEO_ANIMATION_PRESETS.emoji.quality
  const normalizedStartTime =
    typeof startTime.value === 'number' && Number.isFinite(startTime.value) && startTime.value > 0
      ? startTime.value
      : undefined
  const normalizedClipDuration =
    typeof clipDuration.value === 'number' &&
    Number.isFinite(clipDuration.value) &&
    clipDuration.value > 0
      ? clipDuration.value
      : undefined

  let successCount = 0
  const failures: { name: string; error: string }[] = []

  try {
    const { convertVideoToAnimation } = await loadVideoService()
    for (let index = 0; index < targets.length; index++) {
      if (isUnmounted || signal.aborted) break
      const item = targets[index]
      batchStatusText.value =
        targets.length > 1
          ? `正在处理第 ${index + 1}/${targets.length} 个视频：${item.file.name}`
          : `正在处理：${item.file.name}`
      convertProgress.value = { percent: 0, stage: 'init', message: '准备转换...' }
      updateSourceItem(item.id, { status: 'converting', statusError: undefined })

      try {
        const result = await convertVideoToAnimation(item.file, {
          format: outputFormat.value,
          fps: normalizedFps,
          maxWidth: normalizedMaxWidth,
          quality: normalizedQuality,
          startTime: normalizedStartTime,
          duration: normalizedClipDuration,
          gifProfile: gifProfile.value,
          webpLossless: webpLossless.value,
          signal,
          onProgress: progress => {
            if (!isUnmounted) {
              convertProgress.value = progress
            }
          }
        })

        if (isUnmounted || signal.aborted) break

        const previewUrl = URL.createObjectURL(result.blob)
        convertedItems.value = [
          {
            id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            result,
            previewUrl
          },
          ...convertedItems.value
        ]
        updateSourceItem(item.id, { status: 'done', statusError: undefined })
        successCount++

        if (result.warning) {
          message.warning(result.warning)
        }
      } catch (err) {
        if (
          isUnmounted ||
          signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          throw err
        }
        const msg = err instanceof Error ? err.message : String(err)
        updateSourceItem(item.id, { status: 'error', statusError: msg })
        failures.push({ name: item.file.name, error: msg })
      }
    }

    if (isUnmounted) return

    if (failures.length > 0 && successCount > 0) {
      errorMessage.value = failures.map(f => `${f.name}：${f.error}`).join('；')
      message.warning(`已完成 ${successCount} 个视频转换，${failures.length} 个失败`)
    } else if (failures.length > 0) {
      errorMessage.value = failures.map(f => `${f.name}：${f.error}`).join('；')
      message.error(`转换失败：${failures[0].error}`)
    } else if (successCount > 0) {
      message.success(
        `已完成 ${successCount} 个视频的 ${getOutputFormatMeta(outputFormat.value).label} 转换`
      )
    }
  } catch (err) {
    if (isUnmounted) return
    if (err instanceof DOMException && err.name === 'AbortError') {
      message.info('已取消视频转换')
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      errorMessage.value = msg
      message.error(`转换失败：${msg}`)
    }
  } finally {
    isConverting.value = false
    batchStatusText.value = ''
    activeAbortController = null
  }
}

const cancelConversion = () => {
  activeAbortController?.abort(new DOMException('用户取消视频转换', 'AbortError'))
}

const downloadConverted = (item: ConvertedAnimationItem) => {
  const link = document.createElement('a')
  link.href = item.previewUrl
  link.download = item.result.fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const queueSingleToUpload = (item: ConvertedAnimationItem) => {
  emit('addToUpload', [item.result.file])
}

const queueAllToUpload = () => {
  if (!convertedItems.value.length) return
  emit(
    'addToUpload',
    convertedItems.value.map(item => item.result.file)
  )
}

onBeforeUnmount(() => {
  isUnmounted = true
  urlFetchAbortController?.abort(new DOMException('组件已卸载', 'AbortError'))
  urlFetchAbortController = null
  metadataAbortController?.abort(new DOMException('组件已卸载', 'AbortError'))
  metadataAbortController = null
  cancelConversion()
  clearSources()
  clearResults()
})
</script>

<template>
  <div class="space-y-6">
    <!-- 顶部说明与源视频导入区 -->
    <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-semibold dark:text-white flex items-center gap-2">
            <PlayCircleOutlined />
            <span>视频转动图（离线浏览器内转码）</span>
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            内置 FFmpeg WASM 与 AVIF 编码器，可将 MP4 / WebM / MOV 等视频本地转为 GIF、APNG、WebP
            动图或 AVIF 动图，转换后可直接加入待上传队列。
          </p>
        </div>
        <a-tag color="blue">100% 本地离线处理</a-tag>
      </div>

      <!-- 拖拽上传区 -->
      <div
        class="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
        :class="
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        "
        @click="!isConverting && fileInputRef?.click()"
        @drop="handleDrop"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
      >
        <input
          ref="fileInputRef"
          data-testid="video-file-input"
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv,.m4v,.ogv,.gif"
          multiple
          style="display: none"
          @change="handleFileInputChange"
        />
        <p class="text-3xl text-blue-500 mb-2">
          <InboxOutlined />
        </p>
        <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
          拖拽视频文件到此处，或点击选择（支持批量）
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          支持 MP4 / WebM / MOV / MKV / M4V / OGV / GIF（单文件 ≤ 150 MB）
        </p>
      </div>

      <!-- URL 导入 -->
      <div class="flex flex-wrap items-center gap-2">
        <a-input
          v-model:value="videoUrlInput"
          placeholder="或输入公开视频链接（https://.../video.mp4）"
          class="flex-1 min-w-[220px]"
          :disabled="isConverting || isFetchingUrl"
          @pressEnter="handleLoadFromUrl"
        >
          <template #prefix>
            <LinkOutlined class="text-gray-400" />
          </template>
        </a-input>
        <a-button
          :loading="isFetchingUrl"
          :disabled="isConverting || isFetchingUrl || !videoUrlInput.trim()"
          @click="handleLoadFromUrl"
        >
          加载链接
        </a-button>
        <a-button v-if="isFetchingUrl" danger @click="cancelUrlFetch">取消</a-button>
      </div>

      <!-- 已选视频列表与预览 -->
      <div
        v-if="sourceVideos.length > 0"
        class="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700"
      >
        <!-- 列表 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium dark:text-gray-200">
              待转换视频 ({{ sourceVideos.length }})
            </span>
            <a-button size="small" danger :disabled="isConverting" @click="clearSources">
              清空列表
            </a-button>
          </div>
          <div class="max-h-60 overflow-y-auto space-y-2 pr-1">
            <div
              v-for="item in sourceVideos"
              :key="item.id"
              class="flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors"
              :class="
                activeSource?.id === item.id
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              "
              @click="activeSourceId = item.id"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span
                    class="text-sm font-medium truncate dark:text-white"
                    :title="item.file.name"
                  >
                    {{ item.file.name }}
                  </span>
                  <a-tag v-if="item.status === 'converting'" color="processing">转换中</a-tag>
                  <a-tag v-else-if="item.status === 'done'" color="success">已完成</a-tag>
                  <a-tooltip v-else-if="item.status === 'error'" :title="item.statusError">
                    <a-tag color="error">失败</a-tag>
                  </a-tooltip>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-2 mt-0.5">
                  <span>{{ formatBytes(item.file.size) }}</span>
                  <template v-if="item.metadata">
                    <span>{{ item.metadata.width }}×{{ item.metadata.height }}</span>
                    <span>{{ formatDuration(item.metadata.duration) }}</span>
                  </template>
                  <span v-else-if="item.metadataError" class="text-orange-500">
                    {{ item.metadataError }}
                  </span>
                </div>
              </div>
              <a-button
                type="text"
                size="small"
                danger
                :disabled="isConverting"
                title="移除此视频"
                @click.stop="removeSourceVideo(item.id)"
              >
                <template #icon>
                  <DeleteOutlined />
                </template>
              </a-button>
            </div>
          </div>
        </div>

        <!-- 预览播放器 -->
        <div
          v-if="activeSource"
          class="flex flex-col items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900/60 p-3 border border-gray-200 dark:border-gray-700"
        >
          <img
            v-if="activeSource.isGif"
            :src="activeSource.previewUrl"
            :alt="activeSource.file.name"
            class="max-h-56 max-w-full rounded object-contain"
          />
          <div
            v-else-if="activeSource.previewError"
            class="text-xs text-orange-600 dark:text-orange-400 text-center px-3 py-6"
          >
            浏览器无法直接预览该格式，但仍可尝试使用本地 FFmpeg 转换为动图
          </div>
          <video
            v-else
            :key="activeSource.id"
            :src="activeSource.previewUrl"
            controls
            muted
            loop
            playsinline
            class="max-h-56 max-w-full rounded"
            @error="updateSourceItem(activeSource.id, { previewError: true })"
          />
          <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">
            {{ activeSource.file.name }}
          </div>
        </div>
      </div>
    </div>

    <!-- 参数与预设配置区 -->
    <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm font-semibold dark:text-white flex items-center gap-1.5">
          <ThunderboltOutlined />
          <span>转换参数与预设</span>
        </span>
        <div class="flex flex-wrap items-center gap-1.5">
          <a-button
            v-for="(preset, key) in VIDEO_ANIMATION_PRESETS"
            :key="key"
            size="small"
            :type="activePreset === key ? 'primary' : 'default'"
            :disabled="isConverting"
            @click="applyPreset(key)"
          >
            {{ preset.label }}
          </a-button>
        </div>
      </div>

      <!-- 输出格式 -->
      <div class="space-y-2">
        <div class="text-xs font-medium text-gray-600 dark:text-gray-300">输出动图格式</div>
        <a-radio-group v-model:value="outputFormat" :disabled="isConverting">
          <a-radio-button value="gif">GIF</a-radio-button>
          <a-radio-button value="apng">APNG (.png)</a-radio-button>
          <a-radio-button value="webp">WebP 动图</a-radio-button>
          <a-radio-button value="avif">AVIF 动图</a-radio-button>
        </a-radio-group>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDescription }}</p>
        <p
          v-if="showAvifDurationWarning"
          class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2.5 py-1.5"
        >
          当前视频或裁剪片段超过 15 秒，AVIF 动图单次最多支持 15 秒（建议设置裁剪时长 ≤15 秒，或改用
          GIF / WebP / APNG）。
        </p>
      </div>

      <!-- 核心参数 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            帧率 (FPS: 1–30)
          </label>
          <a-input-number
            v-model:value="fps"
            :min="1"
            :max="30"
            :step="1"
            :disabled="isConverting"
            class="w-full"
            @change="markCustomPreset"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            最大宽度 (px，0 为原尺寸)
          </label>
          <a-input-number
            v-model:value="maxWidth"
            :min="0"
            :max="1280"
            :step="16"
            :disabled="isConverting"
            class="w-full"
            @change="markCustomPreset"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            <ScissorOutlined class="mr-1" />
            起始时间 (秒，可选)
          </label>
          <a-input-number
            v-model:value="startTime"
            :min="0"
            :step="0.5"
            placeholder="默认从 0 秒开始"
            :disabled="isConverting"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            <ScissorOutlined class="mr-1" />
            裁剪时长 (秒，可选)
          </label>
          <a-input-number
            v-model:value="clipDuration"
            :min="0.1"
            :step="0.5"
            placeholder="默认完整时长"
            :disabled="isConverting"
            class="w-full"
          />
        </div>
      </div>

      <!-- 格式专属选项 -->
      <div
        v-if="outputFormat === 'gif' || outputFormat === 'webp' || outputFormat === 'avif'"
        class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700"
      >
        <div v-if="outputFormat === 'gif'">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            GIF 调色板质量策略
          </label>
          <a-select v-model:value="gifProfile" :disabled="isConverting" class="w-full">
            <a-select-option value="high">高质量动图（全帧调色板 + Bayer 抖动）</a-select-option>
            <a-select-option value="classic">经典全帧调色板（Floyd-Steinberg）</a-select-option>
            <a-select-option value="small">小体积模式（64 色调色板）</a-select-option>
          </a-select>
        </div>

        <template v-if="outputFormat === 'webp'">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              WebP 画质 (1–100)
            </label>
            <a-input-number
              v-model:value="quality"
              :min="1"
              :max="100"
              :step="5"
              :disabled="isConverting || webpLossless"
              class="w-full"
              @change="markCustomPreset"
            />
          </div>
          <div class="flex items-center gap-2 pt-5">
            <a-switch v-model:checked="webpLossless" :disabled="isConverting" />
            <span class="text-sm text-gray-700 dark:text-gray-300">启用无损 WebP</span>
          </div>
        </template>

        <div v-if="outputFormat === 'avif'">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            AVIF 画质 (1–100)
          </label>
          <a-input-number
            v-model:value="quality"
            :min="1"
            :max="100"
            :step="5"
            :disabled="isConverting"
            class="w-full"
            @change="markCustomPreset"
          />
        </div>
      </div>

      <!-- 错误提示 -->
      <div
        v-if="errorMessage"
        class="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
      >
        {{ errorMessage }}
      </div>

      <!-- 进度与执行按钮 -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div class="flex-1 min-w-[220px]">
          <template v-if="isConverting">
            <div class="text-xs text-gray-600 dark:text-gray-300 mb-1">
              {{ batchStatusText }} · {{ convertProgress.message }}
            </div>
            <a-progress :percent="convertProgress.percent" status="active" />
          </template>
        </div>
        <div class="flex items-center gap-2">
          <a-button v-if="isConverting" danger @click="cancelConversion">
            <template #icon>
              <StopOutlined />
            </template>
            取消转换
          </a-button>
          <a-button
            type="primary"
            :disabled="sourceVideos.length === 0 || isConverting"
            :loading="isConverting"
            data-testid="start-video-convert"
            @click="startConversion"
          >
            <template #icon>
              <PlayCircleOutlined />
            </template>
            {{
              isConverting
                ? '转换中...'
                : `开始转换为 ${getOutputFormatMeta(outputFormat).label} (${sourceVideos.length})`
            }}
          </a-button>
        </div>
      </div>
    </div>

    <!-- 转换结果区 -->
    <div v-if="convertedItems.length > 0" class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 class="text-base font-semibold dark:text-white">
          转换结果 ({{ convertedItems.length }})
        </h3>
        <div class="flex flex-wrap items-center gap-2">
          <a-button
            type="primary"
            size="small"
            data-testid="queue-all-converted"
            @click="queueAllToUpload"
          >
            <template #icon>
              <CloudUploadOutlined />
            </template>
            全部加入待上传
          </a-button>
          <a-button size="small" danger @click="clearResults">清空结果</a-button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="item in convertedItems"
          :key="item.id"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2 bg-gray-50/70 dark:bg-gray-900/40"
          data-testid="converted-animation-card"
        >
          <div
            class="aspect-square rounded overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700"
          >
            <img
              :src="item.previewUrl"
              :alt="item.result.fileName"
              class="max-w-full max-h-full object-contain"
            />
          </div>

          <div class="text-sm font-medium truncate dark:text-white" :title="item.result.fileName">
            {{ item.result.fileName }}
          </div>

          <div class="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <a-tag color="green">{{ getOutputFormatMeta(item.result.format).label }}</a-tag>
            <span v-if="item.result.width > 0">
              {{ item.result.width }}×{{ item.result.height }}
            </span>
            <span>{{ formatBytes(item.result.size) }}</span>
            <span v-if="formatSizeDelta(item.result)">({{ formatSizeDelta(item.result) }})</span>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <a-button
              type="primary"
              size="small"
              class="flex-1"
              data-testid="queue-single-converted"
              @click="queueSingleToUpload(item)"
            >
              <template #icon>
                <CloudUploadOutlined />
              </template>
              加入待上传
            </a-button>
            <a-tooltip title="下载到本地">
              <a-button size="small" @click="downloadConverted(item)">
                <template #icon>
                  <DownloadOutlined />
                </template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除结果">
              <a-button size="small" danger @click="removeConvertedItem(item.id)">
                <template #icon>
                  <DeleteOutlined />
                </template>
              </a-button>
            </a-tooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
