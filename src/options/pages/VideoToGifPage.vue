<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
// These packages will be added as dependencies
import { FFmpeg, type LogEvent, type ProgressEvent } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

// UI state
const ready = ref(false)
const loading = ref(false)
const loadingMessage = ref('')
const converting = ref(false)
const progress = ref(0)
const logLines = ref<string[]>([])

// Inputs
const file = ref<File | null>(null)
const fileName = ref('')
const fileList = ref([])
const url = ref('')
const fps = ref(10)
const width = ref(480)
const height = ref(-1)
const startTime = ref<number | ''>('') // seconds
const duration = ref<number | ''>('') // seconds

// Output
const outputUrl = ref<string | null>(null)
const outputSize = ref<number | null>(null)

const ffmpeg = new FFmpeg()

async function autofillVideoInfo() {
  if (!file.value) {
    alert('请先选择 MP4 文件')
    return
  }
  await ensureLoaded()
  try {
    // 写入临时文件
    await ffmpeg.writeFile('probe.mp4', await fetchFile(file.value))
    
    // 用临时日志监听器捕获 ffmpeg -i 的输出（输出到 stderr）
    let capturedLogs: string[] = []
    const tempLogHandler = ({ message }: LogEvent) => {
      capturedLogs.push(message)
    }
    ffmpeg.on('log', tempLogHandler)
    
    // 执行 ffmpeg -i（会失败，但会输出 probe 信息）
    try {
      await ffmpeg.exec(['-i', 'probe.mp4'])
    } catch {
      // 预期会失败（因为没有指定输出文件）
    }
    
    // 移除临时监听器
    ffmpeg.off('log', tempLogHandler)
    
    const infoStr = capturedLogs.join('\n')
    // 解析 width/height/fps
    // 日志输出 ffmpeg probe 原始内容
    appendLog('【ffmpeg probe 输出】\n' + infoStr)
    // 示例：Stream #0:0: Video: h264 (Main), yuv420p(progressive), 1280x1280, ... 6.25 fps, ...
    // 兼容 Stream #...: Video: ... 行
    const videoLine = infoStr.split('\n').find(line => line.includes('Video:'))
    if (videoLine) {
      appendLog('【识别到 Video 行】' + videoLine)
      const whMatch = videoLine.match(/(\d{2,5})x(\d{2,5})/)
      if (whMatch) {
        width.value = Number(whMatch[1])
        height.value = Number(whMatch[2])
        appendLog(`【参数识别成功】宽度=${whMatch[1]}, 高度=${whMatch[2]}`)
      }
      const fpsMatch = videoLine.match(/(\d+(?:\.\d+)?)\s*fps/)
      if (fpsMatch) {
        fps.value = Math.round(Number(fpsMatch[1]))
        appendLog(`【参数识别成功】FPS=${fpsMatch[1]}`)
      } else {
        // 兼容 tbr
        const tbrMatch = videoLine.match(/(\d+(?:\.\d+)?)\s*tbr/)
        if (tbrMatch) {
          fps.value = Math.round(Number(tbrMatch[1]))
          appendLog(`【参数识别成功】FPS(tbr)=${tbrMatch[1]}`)
        }
      }
    } else {
      appendLog('【参数识别失败】未能识别视频参数，未找到包含 Video: 的行')
      alert('未能识别视频参数')
    }
  } catch (err: any) {
    alert('分析视频参数失败：' + (err?.message || String(err)))
  }
}

function appendLog(message: string) {
  if (!message) return
  const max = 200
  logLines.value.push(message)
  if (logLines.value.length > max) logLines.value.splice(0, logLines.value.length - max)
}

async function ensureLoaded() {
  if (ready.value) return
  loading.value = true
  loadingMessage.value = '加载转码引擎（首次较慢）…'
  // Load ffmpeg core from local extension assets to satisfy extension CSP
  const base = (window as any).chrome?.runtime?.getURL
    ? (window as any).chrome.runtime.getURL('assets/ffmpeg/')
    : '/assets/ffmpeg/'
  ffmpeg.on('log', ({ message }: LogEvent) => appendLog(message))
  ffmpeg.on('progress', ({ progress: p }: ProgressEvent) => {
    // p is 0..1
    progress.value = Math.round((p || 0) * 100)
  })
  await ffmpeg.load({
    coreURL: `${base}ffmpeg-core.js`,
    wasmURL: `${base}ffmpeg-core.wasm`
  })
  ready.value = true
  loading.value = false
  loadingMessage.value = ''
}

// a-upload change 事件处理
function handleUploadChange(info: any) {
  fileList.value = info.fileList
  if (info.fileList && info.fileList.length > 0) {
    const f = info.fileList[0]
    file.value = f.originFileObj as File
    fileName.value = f.name || (f.originFileObj && f.originFileObj.name) || ''
  } else {
    file.value = null
    fileName.value = ''
  }
}

async function getInputData(): Promise<{ name: string; data: Uint8Array }> {
  if (file.value) {
    const data = await fetchFile(file.value)
    return { name: 'input.mp4', data }
  }
  if (url.value.trim()) {
    const u = url.value.trim()
    const resp = await fetch(u)
    if (!resp.ok) throw new Error(`下载失败：${resp.status}`)
    const ab = await resp.arrayBuffer()
    return { name: 'input.mp4', data: new Uint8Array(ab) }
  }
  throw new Error('请先选择文件或填写视频 URL')
}

function buildArgs(inputName: string, outputName: string) {
  const vf: string[] = []
  const fpsVal = Number(fps.value || 0)
  if (fpsVal > 0) vf.push(`fps=${fpsVal}`)
  const widthVal = Number(width.value || 0)
  if (widthVal > 0) vf.push(`scale=${widthVal}:-1:flags=lanczos`)

  const args: string[] = []
  if (startTime.value !== '' && Number(startTime.value) >= 0) {
    args.push('-ss', String(startTime.value))
  }
  args.push('-i', inputName)
  if (duration.value !== '' && Number(duration.value) > 0) {
    args.push('-t', String(duration.value))
  }
  if (vf.length) {
    args.push('-vf', vf.join(','))
  }
  args.push('-loop', '0', '-f', 'gif', outputName)
  return args
}

async function convert() {
  try {
    await ensureLoaded()
    converting.value = true
    progress.value = 0
    outputUrl.value && URL.revokeObjectURL(outputUrl.value)
    outputUrl.value = null
    outputSize.value = null
    appendLog('开始转码…')

    const input = await getInputData()
    await ffmpeg.writeFile(input.name, input.data)

    const outputName = 'output.gif'
    const args = buildArgs(input.name, outputName)
  appendLog(`执行命令：ffmpeg ${args.join(' ')}`)
    await ffmpeg.exec(args)

  const out = await ffmpeg.readFile(outputName)
  // ffmpeg.readFile returns Uint8Array | string; normalize to Uint8Array
  const outData = out instanceof Uint8Array ? out : new TextEncoder().encode(String(out))
  const ab = outData.buffer as unknown as ArrayBuffer
  const blob = new Blob([ab], { type: 'image/gif' })
    outputSize.value = blob.size
    outputUrl.value = URL.createObjectURL(blob)
    appendLog('转码完成')
  } catch (err: any) {
    appendLog(`错误：${err?.message || String(err)}`)
    alert(err?.message || String(err))
  } finally {
    converting.value = false
  }
}

function resetAll() {
  file.value = null
  fileName.value = ''
  fileList.value = []
  url.value = ''
  fps.value = 10
  width.value = 480
  startTime.value = ''
  duration.value = ''
  if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
  outputUrl.value = null
  outputSize.value = null
  logLines.value = []
}

function downloadGif() {
  if (!outputUrl.value) return
  const a = document.createElement('a')
  a.href = outputUrl.value
  a.download = 'video.gif'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

onBeforeUnmount(() => {
  if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
})
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold dark:text-white">视频转 GIF</h2>
    <p class="text-sm text-gray-500 dark:text-gray-300">
      支持上传 MP4 文件或填写视频 URL，在浏览器本地使用 ffmpeg.wasm 转为 GIF。
    </p>

    <!-- Inputs -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
        <label class="block text-sm mb-2 dark:text-white">上传 MP4 文件</label>
        <a-upload
          v-model:file-list="fileList"
          :showUploadList="false"
          :beforeUpload="() => false"
          accept="video/mp4"
          @change="handleUploadChange"
        >
          <a-button type="primary">选择文件</a-button>
        </a-upload>
        <p v-if="fileName" class="mt-2 text-xs text-gray-500 dark:text-gray-300">已选择：{{ fileName }}</p>
      </div>

      <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
        <label class="block text-sm mb-2 dark:text-white">或填写视频 URL</label>
        <input v-model="url" type="url" placeholder="https://example.com/video.mp4" class="w-full px-3 py-2 rounded border dark:border-gray-700 dark:bg-gray-900" />
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-300">某些站点可能受 CORS 限制；扩展已包含 <code>&lt;all_urls&gt;</code> 权限。</p>
      </div>
    </div>

    <!-- Params -->
  <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
  <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800 flex flex-col justify-between">
  <label class="block text-sm mb-2 dark:text-white">FPS</label>
  <input v-model.number="fps" type="number" min="1" max="30" class="w-full px-3 py-2 rounded border dark:border-gray-700 dark:bg-gray-900 mb-2" />
  <a-button size="small" @click="autofillVideoInfo" :disabled="!file">一键填入 MP4 参数</a-button>
      </div>
      <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
        <label class="block text-sm mb-2 dark:text-white">宽度 (px)</label>
        <input v-model.number="width" type="number" min="64" max="1280" step="16" class="w-full px-3 py-2 rounded border dark:border-gray-700 dark:bg-gray-900" />
      </div>
      <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
        <label class="block text-sm mb-2 dark:text-white">高度 (px)</label>
        <input v-model.number="height" type="number" min="64" max="1280" step="16" class="w-full px-3 py-2 rounded border dark:border-gray-700 dark:bg-gray-900" />
      </div>
      <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
  <label class="block text-sm mb-2 dark:text-white">起始时间 (s)</label>
        <input v-model="startTime" type="number" min="0" class="w-full px-3 py-2 rounded border dark:border-gray-700 dark:bg-gray-900" />
      </div>
      <div class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
  <label class="block text-sm mb-2 dark:text-white">持续时长 (s)</label>
        <input v-model="duration" type="number" min="1" class="w-full px-3 py-2 rounded border dark:border-gray-700 dark:bg-gray-900" />
      </div>
    </div>

    <div class="flex items-center gap-3">
      <a-button type="primary" :loading="converting || loading" :disabled="converting || loading" @click="convert">
        {{ converting ? '转换中…' : '开始转换' }}
      </a-button>
      <a-button @click="resetAll">重置</a-button>
      <span v-if="loading" class="text-sm text-gray-500 dark:text-gray-300">{{ loadingMessage }}</span>
      <span v-if="converting" class="text-sm text-gray-500 dark:text-gray-300">进度：{{ progress }}%</span>
    </div>

    <!-- Result -->
    <div v-if="outputUrl" class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
      <div class="flex items-center justify-between">
        <h3 class="font-medium dark:text-white">结果预览</h3>
  <a-button type="primary" @click="downloadGif">下载 GIF</a-button>
      </div>
      <p class="text-xs mt-1 text-gray-500 dark:text-gray-300">大小：{{ (outputSize || 0) / 1024 | 0 }} KB</p>
      <div class="mt-3 overflow-auto">
        <img :src="outputUrl" alt="GIF 预览" class="max-w-full" />
      </div>
    </div>

    <!-- Logs -->
    <details class="p-4 rounded border dark:border-gray-700 dark:bg-gray-800">
      <summary class="cursor-pointer dark:text-white">日志</summary>
      <pre class="mt-2 text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-300">{{ logLines.join('\n') }}</pre>
    </details>
  </div>
</template>

<style scoped>
</style>
