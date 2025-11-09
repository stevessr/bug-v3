import { FFmpeg } from '/assets/ffmpeg/esm/index.js'
import {
  fetchFile,
  toBlobURL
} from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js'

let ffmpeg = null
let loaded = false
let videoMetadata = null
let suppressFFmpegLogs = false // 控制是否抑制 FFmpeg 日志输出

function log(msg) {
  const logEl = document.getElementById('log')
  logEl.textContent += new Date().toLocaleTimeString() + ' - ' + msg + '\n'
  logEl.scrollTop = logEl.scrollHeight
}

// 初始化提示
log('✅ 本应用完全在浏览器中运行，无需后端服务')
log('💡 首次使用需要下载 FFmpeg（约 30MB），请耐心等待')

// 获取视频元数据
async function getVideoMetadata(source) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      const metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        fps: 25 // 默认值，无法从 video 元素直接获取准确帧率
      }
      URL.revokeObjectURL(video.src)
      resolve(metadata)
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('无法读取视频信息'))
    }

    if (source instanceof File) {
      video.src = URL.createObjectURL(source)
    } else {
      // First try direct URL, only use proxy if direct access fails
      video.src = source
      video.crossOrigin = 'anonymous'
    }
  })
}

// 监听文件选择，自动获取元数据
document.getElementById('fileInput').addEventListener('change', async e => {
  const file = e.target.files[0]
  if (file) {
    try {
      log('正在读取视频信息...')
      videoMetadata = await getVideoMetadata(file)
      document.getElementById('originalBtn').disabled = false
      log(
        `视频信息：${videoMetadata.width}x${videoMetadata.height}, ${videoMetadata.duration.toFixed(1)}秒`
      )
    } catch (err) {
      log('读取视频信息失败：' + err.message)
      videoMetadata = null
      document.getElementById('originalBtn').disabled = true
    }
  }
})

// 监听 URL 输入
document.getElementById('urlInput').addEventListener('input', e => {
  const url = e.target.value.trim()
  const analyzeBtn = document.getElementById('analyzeBtn')
  analyzeBtn.disabled = !url

  // 清空之前的元数据
  if (!url) {
    videoMetadata = null
    document.getElementById('originalBtn').disabled = true
  }
})

// 从 URL 分析视频
window.analyzeVideoFromUrl = async function () {
  const urlInput = document.getElementById('urlInput')
  const url = urlInput.value.trim()

  if (!url) {
    log('请输入视频 URL')
    return
  }

  try {
    log('正在分析视频...')
    videoMetadata = await getVideoMetadata(url)
    document.getElementById('originalBtn').disabled = false
    log(
      `视频信息：${videoMetadata.width}x${videoMetadata.height}, ${videoMetadata.duration.toFixed(1)}秒`
    )
  } catch (err) {
    log('直接分析视频失败：' + err.message)
    log('尝试使用代理下载...')
    // Fallback to proxy if direct access fails
    try {
      const proxyUrl = `/api/video/proxy?url=${encodeURIComponent(url)}`
      videoMetadata = await getVideoMetadata(proxyUrl)
      document.getElementById('originalBtn').disabled = false
      log(
        `视频信息：${videoMetadata.width}x${videoMetadata.height}, ${videoMetadata.duration.toFixed(1)}秒`
      )
    } catch (proxyErr) {
      log('代理下载也失败：' + proxyErr.message)
      videoMetadata = null
      document.getElementById('originalBtn').disabled = true
    }
  }
}

// 使用原视频参数
window.useOriginalParams = function () {
  if (!videoMetadata) {
    log('未找到视频信息')
    return
  }

  document.getElementById('fps').value = videoMetadata.fps
  document.getElementById('width').value = videoMetadata.width
  document.getElementById('height').value = videoMetadata.height
  document.getElementById('startTime').value = ''
  document.getElementById('duration').value = ''

  // 视觉反馈
  document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'))
  event.target.classList.add('active')

  log(`已应用原视频参数：${videoMetadata.width}x${videoMetadata.height} @ ${videoMetadata.fps}fps`)
}

// 预设配置
const presets = {
  high: { fps: 15, width: 720, height: -1, startTime: '', duration: '', name: '高质量' },
  medium: { fps: 10, width: 480, height: -1, startTime: '', duration: '', name: '平衡' },
  low: { fps: 8, width: 360, height: -1, startTime: '', duration: '', name: '低体积' },
  emoji: { fps: 12, width: 320, height: 320, startTime: '', duration: '', name: '表情包' },
  short: { fps: 10, width: 480, height: -1, startTime: 0, duration: 3, name: '3 秒片段' }
}

// 应用预设
window.applyPreset = function (presetName) {
  const preset = presets[presetName]
  if (!preset) return

  document.getElementById('fps').value = preset.fps
  document.getElementById('width').value = preset.width
  document.getElementById('height').value = preset.height
  document.getElementById('startTime').value = preset.startTime
  document.getElementById('duration').value = preset.duration

  // 视觉反馈
  document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'))
  event.target.classList.add('active')

  log(`已应用预设：${preset.name}`)
}

async function loadFFmpeg() {
  if (loaded) return
  log('正在加载 FFmpeg（首次加载约 30MB，请耐心等待）...')

  try {
    // 混合方案：小文件用本地，大文件（wasm）用 CDN
    const localBase = window.location.origin + '/assets/ffmpeg'
    const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

    log('下载 FFmpeg 文件...')
    // 本地文件（已打包在 Pages）
    const coreURL = await toBlobURL(`${localBase}/ffmpeg-core.js`, 'text/javascript')
    const workerURL = await toBlobURL(`${localBase}/worker.js`, 'text/javascript')

    // WASM 从 CDN 加载（避免 Pages 25MB 限制）
    log('从 CDN 下载 WASM 文件（30MB）...')
    const wasmURL = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm')

    log('✓ 文件下载完成，转换为 Blob URL')

    log('初始化 FFmpeg 实例...')
    // 延迟创建 FFmpeg 实例，避免过早加载 Worker
    if (!ffmpeg) {
      ffmpeg = new FFmpeg()
      ffmpeg.on('log', ({ message }) => {
        if (!suppressFFmpegLogs) {
          log(`[FFmpeg] ${message}`)
        }
      })
      ffmpeg.on('progress', ({ progress, time }) => {
        log(`处理进度：${(progress * 100).toFixed(2)}%`)
      })
    }

    log('加载 FFmpeg 核心（多线程模式）...')
    try {
      await ffmpeg.load({
        coreURL,
        wasmURL,
        workerURL
      })
      loaded = true
      log('✅ FFmpeg 加载完成（多线程模式）！')
    } catch (workerErr) {
      log('⚠️ 多线程模式失败，尝试单线程模式...')
      log('错误：' + workerErr.message)

      // 降级到单线程模式（不使用 Worker）
      await ffmpeg.load({
        coreURL,
        wasmURL
        // 不传 workerURL，使用单线程
      })
      loaded = true
      log('✅ FFmpeg 加载完成（单线程模式）！')
    }
  } catch (err) {
    log('❌ FFmpeg 加载失败：' + err.message)
    log('提示：首次使用需要从 CDN 下载 30MB 文件，请检查网络连接')
    console.error('FFmpeg 加载错误详情：', err)
    throw err
  }
}

async function convert() {
  const fileInput = document.getElementById('fileInput')
  const urlInput = document.getElementById('urlInput')
  const statusEl = document.getElementById('status')
  const resultEl = document.getElementById('result')
  const btn = document.getElementById('convertBtn')

  // 清空之前的结果
  statusEl.innerHTML = ''
  resultEl.innerHTML = ''

  // 验证输入
  const file = fileInput.files[0]
  const url = urlInput.value.trim()
  if (!file && !url) {
    statusEl.innerHTML = '<div class="error">请选择文件或填写 URL</div>'
    return
  }

  // 禁用按钮
  btn.disabled = true
  btn.textContent = '转换中...'
  log('开始转换...')

  try {
    // 加载 FFmpeg
    await loadFFmpeg()

    // 获取输入数据和文件名
    let inputData
    let originalFileName = 'video' // default name

    if (file) {
      inputData = await fetchFile(file)
      log('文件已读取')
      // Extract original file name without extension
      originalFileName = file.name.replace(/\.[^/.]+$/, '') || 'video'
    } else {
      log('下载中...')
      try {
        // First try direct download
        inputData = await fetchFile(url)
        log('直接下载完成')
      } catch (err) {
        log('直接下载失败：' + err.message)
        log('尝试使用代理下载...')
        // Fallback to proxy if direct download fails
        const proxyUrl = `/api/video/proxy?url=${encodeURIComponent(url)}`
        inputData = await fetchFile(proxyUrl)
        log('通过代理下载完成')
      }
      // Extract filename from URL if possible
      const urlParts = url.split('/')
      const lastPart = urlParts[urlParts.length - 1]
      originalFileName = lastPart.replace(/\.[^/.]+$/, '') || 'video'
    }

    // 写入文件
    await ffmpeg.writeFile('input.mp4', inputData)
    log('开始转码...')

    // 构造参数
    const args = []
    const startTime = document.getElementById('startTime').value
    if (startTime) args.push('-ss', startTime)
    args.push('-i', 'input.mp4')
    const duration = document.getElementById('duration').value
    if (duration) args.push('-t', duration)

    const vf = []
    const fpsVal = document.getElementById('fps').value
    if (fpsVal) vf.push(`fps=${fpsVal}`)
    const widthVal = document.getElementById('width').value
    if (widthVal) {
      const heightVal = document.getElementById('height').value || -1
      vf.push(`scale=${widthVal}:${heightVal}:flags=lanczos`)
    }
    if (vf.length) args.push('-vf', vf.join(','))

    // 输出格式处理
    const format = document.getElementById('format').value
    let outFile = 'output.gif'
    let mime = 'image/gif'
    let extra = []

    if (format === 'gif') {
      // 使用 palettegen/paletteuse 两步法生成高质量 GIF
      log('生成调色板（pass 1）...')
      const p1 = []
      if (startTime) p1.push('-ss', startTime)
      p1.push('-i', 'input.mp4')
      if (duration) p1.push('-t', duration)
      // 与最终输出保持一致的预处理滤镜
      // 用于生成调色板的滤镜（避免与后面合并滤镜变量名冲突）
      const paletteGenFilter = vf.length
        ? `${vf.join(',')},palettegen=stats_mode=full:reserve_transparent=1`
        : 'palettegen=stats_mode=full:reserve_transparent=1'
      p1.push('-vf', paletteGenFilter, '-y', 'palette.png')

      log(`执行：ffmpeg ${p1.join(' ')}`)
      await ffmpeg.exec(p1)

      log('应用调色板生成 GIF（pass 2）...')
      const p2 = []
      if (startTime) p2.push('-ss', startTime)
      p2.push('-i', 'input.mp4', '-i', 'palette.png')
      if (duration) p2.push('-t', duration)
      const gifProfile = document.getElementById('gifProfile').value
      let palettegen = 'palettegen=stats_mode=full:reserve_transparent=1'
      let paletteuse = 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
      if (gifProfile === 'classic') {
        paletteuse = 'paletteuse=dither=floyd_steinberg'
      } else if (gifProfile === 'small') {
        palettegen = 'palettegen=max_colors=32:stats_mode=full:reserve_transparent=1'
        paletteuse = 'paletteuse=dither=none'
      }
      // 合并滤镜
      // 合并后的调色板滤镜（与上面生成调色板的变量区分）
      const paletteFiltersCombined = vf.length ? `${vf.join(',')},${palettegen}` : palettegen
      p1[p1.indexOf('-vf') + 1] = paletteFiltersCombined
      const useFilters = vf.length ? `${vf.join(',')},${paletteuse}` : paletteuse
      p2.push('-lavfi', useFilters, '-loop', '0', '-f', 'gif', '-y', 'output.gif')
      log(`执行：ffmpeg ${p2.join(' ')}`)
      statusEl.innerHTML = '<div class="loading">⏳ 转码中（高质量 GIF，两步处理）...</div>'
      await ffmpeg.exec(p2)

      outFile = 'output.gif'
      mime = 'image/gif'
    } else if (format === 'webp') {
      // webp: 动图 webp 支持，减少大小
      // 将质量映射到 qscale（1-100 -> 粗略映射到 1-100，ffmpeg 实际范围与语义不同，这里简化处理）
      const qCtl = document.getElementById('quality')
      const qNum = qCtl ? Math.min(100, Math.max(1, parseInt(qCtl.value || '100', 10))) : 100
      const qscale = String(Math.round(101 - qNum)) // 数值越大质量越低，反向映射
      extra = ['-loop', '0', '-f', 'webp', '-lossless', '0', '-qscale', qscale]
      outFile = 'output.webp'
      mime = 'image/webp'
      args.push(...extra, outFile)
    } else if (format === 'apng') {
      // apng: 兼容性较好，体积较大
      // APNG 通常是无损，质量控制有限，这里仅保留格式参数
      extra = ['-f', 'apng']
      outFile = 'output.png'
      mime = 'image/apng'
      args.push(...extra, outFile)
    } else if (format === 'avif') {
      // avif: ffmpeg wasm 不支持 AVIF 编码器，直接导出 PNG 再用 WebCodecs 转 AVIF
      const useWebCodecs = document.getElementById('useWebCodecs').checked
      const qInput = document.getElementById('quality')
      const q = qInput ? Math.min(100, Math.max(1, parseInt(qInput.value || '100', 10))) : 100
      const qNorm = q / 100 // 0-1
      log(
        useWebCodecs
          ? 'FFmpeg.wasm 不支持 AVIF，尝试使用 WebCodecs ImageEncoder...'
          : 'FFmpeg.wasm 不支持 AVIF，使用 Canvas 降级方案...'
      )

      // 构建 PNG 导出参数（保留所有视频滤镜）
      const pngArgs = [...args]
      // 使用 png 编码器而不是 -f png
      pngArgs.push('-frames:v', '1', '-c:v', 'png', 'output.png')

      log(`执行：ffmpeg ${pngArgs.join(' ')}`)
      statusEl.innerHTML = '<div class="loading">⏳ 导出 PNG 中...</div>'
      await ffmpeg.exec(pngArgs)

      const pngData = await ffmpeg.readFile('output.png')
      const pngBlob = new Blob([pngData.buffer], { type: 'image/png' })

      // 尝试编码为 AVIF（或降级为 WebP）
      let blob,
        outUrl,
        isRealAvif = false
      try {
        statusEl.innerHTML = useWebCodecs
          ? `<div class="loading">⏳ 使用 WebCodecs 编码 AVIF（质量 ${q}%）...</div>`
          : `<div class="loading">⏳ 处理图像（降级为 WebP，质量 ${q}%）...</div>`

        const imgBitmap = await createImageBitmap(pngBlob)
        const avifBlob = await encodeAvifWithWebCodecs(imgBitmap, useWebCodecs, qNorm)
        blob = avifBlob
        outUrl = URL.createObjectURL(blob)

        // 检查实际输出格式
        isRealAvif = blob.type === 'image/avif'
        log(isRealAvif ? '✅ AVIF 编码成功！' : '✅ 图像转换完成（降级为 WebP 格式）')
      } catch (e) {
        statusEl.innerHTML =
          '<div class="error">❌ 图像处理失败：' + (e.message || e.toString()) + '</div>'
        return
      }

      // 显示结果
      const formatLabel = isRealAvif ? 'AVIF' : 'WebP（AVIF 降级）'
      const downloadExt = isRealAvif ? 'avif' : 'webp'
      const successMsg = isRealAvif
        ? '✅ 转换成功！使用 WebCodecs 编码的真正 AVIF 格式'
        : '✅ 转换成功！<br><small>注意：浏览器不支持 AVIF 编码，已降级为 WebP 格式</small>'

      statusEl.innerHTML = `<div class="success">${successMsg}</div>`
      resultEl.innerHTML = `
        <div class="result">
          <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>结果预览（${formatLabel}）</h3>
              <div style="display:flex; gap:8px;">
                <a href="${outUrl}" download="${originalFileName}.${downloadExt}" class="btn">下载 ${formatLabel}</a>
                <button class="btn" id="copyResult">复制文件</button>
              </div>
          </div>
          <p class="hint">大小：${(blob.size / 1024).toFixed(2)} KB</p>
            ${!isRealAvif ? '<p class="hint">⚠️ 浏览器端暂不支持 AVIF 编码，已自动降级为 WebP 格式（体积小、质量高）</p>' : ''}
          <img src="${outUrl}" alt="结果预览" id="resultImage">
        </div>
      `
      // 复制功能：复制图片到剪贴板
      const copyBtn = document.getElementById('copyResult')
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const imgEl = document.getElementById('resultImage')
          if (!imgEl || !imgEl.src) {
            alert('图片未加载完成，请稍后再试')
            return
          }

          try {
            // 检查 Clipboard API 权限
            if (navigator.clipboard && navigator.permissions) {
              const permission = await navigator.permissions.query({ name: 'clipboard-write' })
              if (permission.state !== 'granted' && permission.state !== 'prompt') {
                throw new Error('Clipboard write permission not granted')
              }
            }

            // 使用 fetch 获取图片 blob
            const response = await fetch(imgEl.src)
            const blob = await response.blob()

            // 确定 MIME 类型
            const imageType =
              blob.type || 'image/' + imgEl.src.split('.').slice(-1)[0].replace('jpg', 'jpeg')

            // 检查是否支持该 MIME 类型
            let canCopyImage = false
            if (ClipboardItem.supports) {
              canCopyImage = await ClipboardItem.supports(imageType)
            } else {
              // 降级：对常见格式做基本检查
              canCopyImage = [
                'image/png',
                'image/jpeg',
                'image/jpg',
                'image/gif',
                'image/webp'
              ].includes(imageType)
            }

            if (canCopyImage) {
              // 使用剪贴板 API 复制
              const data = [new ClipboardItem({ [imageType]: blob })]
              await navigator.clipboard.write(data)

              log('✅ 已复制图片到剪贴板')
              alert('已复制图片到剪贴板，可直接粘贴到其他应用')
            } else {
              // 格式不支持，复制下载链接
              await navigator.clipboard.writeText(outUrl)
              log('ℹ️ 浏览器不支持该图片格式的复制，已复制下载链接')
              alert('浏览器不支持此图片格式的复制，已复制下载链接')
            }
          } catch (e) {
            log('❌ 图片复制失败：' + (e.message || e))
            // 降级：复制下载链接
            try {
              await navigator.clipboard.writeText(outUrl)
              log('ℹ️ 已复制下载链接到剪贴板（浏览器不支持图片复制或权限被拒绝）')
              alert('浏览器不支持图片复制或权限被拒绝，已复制下载链接')
            } catch (e2) {
              alert('复制失败：' + (e2.message || e2))
            }
          }
        })
      }
      log(`文件大小：${(blob.size / 1024).toFixed(2)} KB`)
      return
    }
    if (format !== 'gif' && format !== 'avif') {
      log(`执行：ffmpeg ${args.join(' ')}`)
      statusEl.innerHTML = '<div class="loading">⏳ 转码中，请稍候...</div>'
      await ffmpeg.exec(args)
      log('转码完成！')
    }

    // 读取输出
    const data = await ffmpeg.readFile(outFile)
    const blob = new Blob([data.buffer], { type: mime })
    const outUrl = URL.createObjectURL(blob)

    // 显示结果
    statusEl.innerHTML = '<div class="success">✅ 转换成功！</div>'
    resultEl.innerHTML = `
      <div class="result">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>结果预览（${format.toUpperCase()}）</h3>
          <div style="display:flex; gap:8px;">
            <a href="${outUrl}" download="${originalFileName}.${format === 'apng' ? 'png' : format}" class="btn">下载 ${format.toUpperCase()}</a>
            <button class="btn" id="copyResult">复制文件</button>
          </div>
        </div>
        <p class="hint">大小：${(blob.size / 1024).toFixed(2)} KB</p>
        ${format === 'avif' ? '<p class="hint">AVIF 预览可能不被所有浏览器支持。</p>' : ''}
        <img src="${outUrl}" alt="结果预览" id="resultImage">
      </div>
    `
    // 复制功能：复制图片到剪贴板
    {
      const copyBtn = document.getElementById('copyResult')
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const imgEl = document.getElementById('resultImage')
          if (!imgEl || !imgEl.src) {
            alert('图片未加载完成，请稍后再试')
            return
          }

          try {
            // 检查 Clipboard API 权限
            if (navigator.clipboard && navigator.permissions) {
              const permission = await navigator.permissions.query({ name: 'clipboard-write' })
              if (permission.state !== 'granted' && permission.state !== 'prompt') {
                throw new Error('Clipboard write permission not granted')
              }
            }

            // 使用 fetch 获取图片 blob
            const response = await fetch(imgEl.src)
            const blob = await response.blob()

            // 确定 MIME 类型
            const imageType =
              blob.type || 'image/' + imgEl.src.split('.').slice(-1)[0].replace('jpg', 'jpeg')

            // 检查是否支持该 MIME 类型
            let canCopyImage = false
            if (ClipboardItem.supports) {
              canCopyImage = await ClipboardItem.supports(imageType)
            } else {
              // 降级：对常见格式做基本检查
              canCopyImage = [
                'image/png',
                'image/jpeg',
                'image/jpg',
                'image/gif',
                'image/webp'
              ].includes(imageType)
            }

            if (canCopyImage) {
              // 使用剪贴板 API 复制
              const data = [new ClipboardItem({ [imageType]: blob })]
              await navigator.clipboard.write(data)

              log('✅ 已复制图片到剪贴板')
              alert('已复制图片到剪贴板，可直接粘贴到其他应用')
            } else {
              // 格式不支持，复制下载链接
              await navigator.clipboard.writeText(outUrl)
              log('ℹ️ 浏览器不支持该图片格式的复制，已复制下载链接')
              alert('浏览器不支持此图片格式的复制，已复制下载链接')
            }
          } catch (e) {
            log('❌ 图片复制失败：' + (e.message || e))
            // 降级：复制下载链接
            try {
              await navigator.clipboard.writeText(outUrl)
              log('ℹ️ 已复制下载链接到剪贴板（浏览器不支持图片复制或权限被拒绝）')
              alert('浏览器不支持图片复制或权限被拒绝，已复制下载链接')
            } catch (e2) {
              alert('复制失败：' + (e2.message || e2))
            }
          }
        })
      }
    }
    log(`文件大小：${(blob.size / 1024).toFixed(2)} KB`)
  } catch (err) {
    let msg = err && (err.message || err.toString()) ? err.message || err.toString() : '未知错误'
    log('错误：' + msg)
    // 针对 AVIF 编码失败，给出更友好的提示
    if (format === 'avif') {
      statusEl.innerHTML =
        '<div class="error">❌ AVIF 编码失败，当前 FFmpeg.wasm 不支持。已自动尝试 WebCodecs（如浏览器支持）。<br>详细信息：' +
        msg +
        '</div>'
    } else {
      statusEl.innerHTML = '<div class="error">❌ ' + msg + '</div>'
    }
  } finally {
    btn.disabled = false
    btn.textContent = '开始转换'
  }
}

function reset() {
  document.getElementById('fileInput').value = ''
  document.getElementById('urlInput').value = ''
  document.getElementById('fps').value = '10'
  document.getElementById('width').value = '480'
  document.getElementById('height').value = '-1'
  document.getElementById('startTime').value = ''
  document.getElementById('duration').value = ''
  document.getElementById('status').innerHTML = ''
  document.getElementById('result').innerHTML = ''
  document.getElementById('log').textContent = ''
  log('已重置')
}

// 暴露到全局
window.convert = convert
window.reset = reset

// UI: 根据格式显示/隐藏 GIF 模式
const formatEl = document.getElementById('format')
const gifProfileGroup = document.getElementById('gifProfileGroup')
const avifWebCodecsGroup = document.getElementById('avifWebCodecsGroup')
const qualityInput = document.getElementById('quality')
const qualityValue = document.getElementById('qualityValue')

function toggleGifProfile() {
  gifProfileGroup.style.display = formatEl.value === 'gif' ? 'block' : 'none'
  avifWebCodecsGroup.style.display = formatEl.value === 'avif' ? 'block' : 'none'
  const gq = document.getElementById('globalQualityGroup')
  // GIF 和 APNG 隐藏质量滑块（GIF 用模式控制，APNG 无损不支持质量调节）
  if (gq)
    gq.style.display = formatEl.value === 'gif' || formatEl.value === 'apng' ? 'none' : 'block'
}
formatEl.addEventListener('change', toggleGifProfile)
// 初始化
toggleGifProfile()

// 全局质量数值显示绑定
if (qualityInput && qualityValue) {
  const sync = () => {
    qualityValue.textContent = `${qualityInput.value}%`
  }
  qualityInput.addEventListener('input', sync)
  qualityInput.addEventListener('change', sync)
  sync()
}

// 初始化日志
log('页面加载完成')
log('本应用完全在浏览器中运行，无需后端服务')

// 检查编码器支持
async function checkEncoders() {
  await loadFFmpeg()

  // 抑制编码器列表输出
  suppressFFmpegLogs = true
  await ffmpeg.exec(['-hide_banner', '-encoders'])
  const encodersTxt = await ffmpeg.readFile('ffmpeg.log', { encoding: 'utf8' })
  suppressFFmpegLogs = false

  let support = { gif: false, webp: false, apng: false, avif: false }
  if (encodersTxt) {
    support.gif = /gif/i.test(encodersTxt)
    support.webp = /webp/i.test(encodersTxt)
    support.apng = /apng/i.test(encodersTxt)
    support.avif = /avif/i.test(encodersTxt)
  }

  // AVIF 始终可用（降级为 WebP）
  const formatEl = document.getElementById('format')
  Array.from(formatEl.options).forEach(opt => {
    if (opt.value === 'avif') {
      // AVIF 选项始终启用，但会降级为 WebP
      opt.text = 'AVIF（降级为 WebP）'
    } else if (support[opt.value] === false) {
      opt.disabled = true
      opt.text += '（不支持）'
    }
  })
}
checkEncoders()

// WebCodecs API AVIF 编码辅助函数
async function encodeAvifWithWebCodecs(imgBitmap, useRealWebCodecs = false, quality = 0.8) {
  // 方案 1: 使用真正的 WebCodecs ImageEncoder API（实验性）
  if (useRealWebCodecs && 'ImageEncoder' in window) {
    try {
      log('🎯 使用 WebCodecs ImageEncoder 编码真正的 AVIF...')

      const encoder = new ImageEncoder({
        mimeType: 'image/avif',
        width: imgBitmap.width,
        height: imgBitmap.height,
        quality: quality
      })

      // 编码为 AVIF
      await encoder.encode(imgBitmap)
      const result = await encoder.flush()

      log('✅ WebCodecs 编码完成，输出真正的 AVIF 格式')
      return new Blob([result], { type: 'image/avif' })
    } catch (e) {
      log('❌ WebCodecs 编码失败：' + e.message)
      log('⚠️ 降级为 Canvas WebP 方案...')
      // 如果失败，降级到方案 2
    }
  }

  // 方案 2: Canvas 降级方案（WebP 替代 AVIF）
  return new Promise((resolve, reject) => {
    log('使用 Canvas 降级方案（WebP 替代 AVIF）...')
    // 创建 canvas 并绘制图像
    const canvas = document.createElement('canvas')
    canvas.width = imgBitmap.width
    canvas.height = imgBitmap.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgBitmap, 0, 0)

    // 转换为 WebP（作为 AVIF 的替代，因为浏览器原生支持）
    // 注意：这里实际上无法在浏览器端直接生成 AVIF
    // 真正的 AVIF 编码需要服务端或使用 WASM 编码器库
    canvas.toBlob(
      blob => {
        if (blob) {
          // 返回 WebP blob，标记为 AVIF（实际是降级方案）
          log('⚠️ 浏览器不支持 AVIF 编码，已降级为 WebP 格式')
          resolve(new Blob([blob], { type: 'image/webp' }))
        } else {
          reject(new Error('Canvas toBlob 失败'))
        }
      },
      'image/webp',
      quality
    )
  })
}
