#!/usr/bin/env node
/**
 * 上传文件夹中的图片到协作上传服务器，并生成表情分组风格的 JSON
 * 用法：node upload-folder.js [upload folder] <emoji group name> [options]
 *
 * 选项：
 *   --server <url>        服务器地址 (默认：ws://localhost:9527)
 *   --thumbnail <size>    缩图尺寸 (默认：100)
 *   --output-file <path>  输出 JSON 文件路径
 *   --log-file <path>     失败日志文件路径
 *   --resume              启用断点续传（读取已存在的 JSON 文件）
 *   --max-retries <num>   最大重试次数 (默认：8)
 *   --retry-delay <ms>    重试基础延迟 (默认：1000ms)
 *
 * 兼容 linux.do 上传接口返回格式：
 * {
 *   "id": 1537930,
 *   "url": "https://linux.do/uploads/default/original/4X/e/b/b/ebbe4ff7f5a301b4696fd541ed2509aca5a5a71f.jpeg",
 *   "original_filename": "image.jpg",
 *   "filesize": 35367,
 *   "width": 300,
 *   "height": 522,
 *   "thumbnail_width": 287,
 *   "thumbnail_height": 500,
 *   "extension": "jpeg",
 *   "short_url": "upload://xDtWLTsDH4kCD1xK4f5sempvO47.jpeg",
 *   "short_path": "/uploads/short-url/xDtWLTsDH4kCD1xK4f5sempvO47.jpeg",
 *   "retain_hours": null,
 *   "human_filesize": "34.5 KB",
 *   "dominant_color": "C5C5C5",
 *   "thumbnail": null
 * }
 */

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import WebSocket from 'ws'

// ==================== 配置 ====================

const DEFAULT_SERVER = 'ws://localhost:9527'
const DEFAULT_THUMBNAIL_SIZE = 100
const DEFAULT_MAX_RETRIES = 8
const DEFAULT_RETRY_DELAY = 1000
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif'
])

// ==================== 工具函数 ====================

function parseArgs(argv) {
  const args = {
    folder: null,
    groupName: null,
    server: DEFAULT_SERVER,
    thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
    outputFile: null,
    logFile: null,
    resume: false,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryDelay: DEFAULT_RETRY_DELAY
  }

  let positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--server':
        args.server = argv[++i]
        break
      case '--thumbnail':
        args.thumbnailSize = Number.parseInt(argv[++i], 10)
        break
      case '--output-file':
        args.outputFile = path.resolve(process.cwd(), argv[++i])
        break
      case '--log-file':
        args.logFile = path.resolve(process.cwd(), argv[++i])
        break
      case '--resume':
        args.resume = true
        break
      case '--max-retries':
        args.maxRetries = Number.parseInt(argv[++i], 10)
        break
      case '--retry-delay':
        args.retryDelay = Number.parseInt(argv[++i], 10)
        break
      default:
        if (!arg.startsWith('--')) {
          positional.push(arg)
        } else {
          console.warn(`Unknown option ignored: ${arg}`)
        }
        break
    }
  }

  if (positional.length < 2) {
    console.error('Usage: node upload-folder.js [upload folder] <emoji group name> [options]')
    console.error('  [upload folder]     要上传的文件夹路径')
    console.error('  <emoji group name>   表情分组名称')
    console.error('  --server <url>       服务器地址 (默认: ws://localhost:9527)')
    console.error('  --thumbnail <size>   缩图尺寸 (默认：100)')
    console.error('  --output-file <path> 输出 JSON 文件路径 (默认: emojis-{name}.json)')
    console.error('  --log-file <path>    失败日志文件路径')
    console.error('  --resume             启用断点续传')
    console.error('  --max-retries <num>  最大重试次数 (默认：8)')
    console.error('  --retry-delay <ms>   重试基础延迟 (默认：1000ms)')
    process.exit(1)
  }

  args.folder = path.resolve(process.cwd(), positional[0])
  args.groupName = positional[1]

  // 如果没有指定输出文件，使用默认文件名
  if (!args.outputFile) {
    const sanitizedGroupName = args.groupName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    args.outputFile = path.resolve(process.cwd(), `emojis-${sanitizedGroupName}.json`)
  }

  return args
}

function listImageFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Folder not found: ${dir}`)
    process.exit(1)
  }

  const results = []
  const stack = [dir]

  while (stack.length > 0) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (IMAGE_EXTENSIONS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  }

  results.sort()
  return results
}

function loadExistingEmojiData(outputFile) {
  if (!fs.existsSync(outputFile)) {
    return new Map()
  }

  try {
    const content = fs.readFileSync(outputFile, 'utf8')
    const emojis = JSON.parse(content)
    const emojiMap = new Map()

    if (Array.isArray(emojis)) {
      for (const emoji of emojis) {
        if (emoji.name) {
          emojiMap.set(emoji.name, emoji)
        }
      }
    }

    return emojiMap
  } catch (error) {
    console.error(`Warning: Failed to load existing emoji data: ${error.message}`)
    return new Map()
  }
}

function saveEmojiData(outputFile, emojis) {
  const dir = path.dirname(outputFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(outputFile, JSON.stringify(emojis, null, 2), 'utf8')
}

function mimeTypeForExt(ext) {
  if (ext === '.avif') return 'image/avif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff'
  return 'application/octet-stream'
}

function generateEmojiId(groupId, index) {
  const randomPart = Math.random().toString(36).substring(2, 7)
  return `emoji-${groupId}-${index}-${randomPart}`
}

function getThumbnailUrl(url, size) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}thumbnail=${size}`
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== WebSocket 客户端 ====================

class UploadClient {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl
    this.ws = null
    this.sessionId = null
    this.serverStats = null
    this.pendingFiles = new Map()
    this.uploadedFiles = []
    this.failedFiles = []
    this.thumbnailSize = options.thumbnailSize || DEFAULT_THUMBNAIL_SIZE
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES
    this.retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY
    this.rateLimitUntil = 0
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.error(`Connecting to server: ${this.serverUrl}`)
      const ws = new WebSocket(this.serverUrl)
      this.ws = ws

      ws.on('open', () => {
        console.error('WebSocket connected, creating session...')
        ws.send(JSON.stringify({ type: 'CREATE_SESSION', uuid: randomUUID() }))
      })

      ws.on('message', (data) => {
        this.handleMessage(data)
        if (this.sessionId) resolve()
      })

      ws.on('error', (err) => {
        console.error('WebSocket error:', err)
        reject(err)
      })

      ws.on('close', () => {
        console.error('WebSocket closed')
        if (!this.sessionId) {
          reject(new Error('Connection closed before session created'))
        }
      })
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  async uploadFiles(files, existingEmojiMap = new Map()) {
    if (!this.ws || !this.sessionId) {
      throw new Error('Not connected to server')
    }

    console.error(`Preparing to upload ${files.length} files...`)

    // 过滤掉已上传的文件（断点续传）
    const filesToUpload = files.filter(filePath => {
      const fileName = path.basename(filePath)
      const ext = path.extname(fileName)
      const nameWithoutExt = path.basename(fileName, ext)
      return !existingEmojiMap.has(nameWithoutExt)
    })

    console.error(`Resuming: ${existingEmojiMap.size} files already uploaded, ${filesToUpload.length} files to upload`)

    // 读取所有文件并创建任务
    const tasks = []
    const groupId = `group-${Date.now()}`
    let packetIndex = existingEmojiMap.size + 1

    for (let i = 0; i < filesToUpload.length; i++) {
      const filePath = filesToUpload[i]
      const fileName = path.basename(filePath)
      const ext = path.extname(fileName).toLowerCase()
      const buffer = fs.readFileSync(filePath)

      const taskId = randomUUID()
      const emojiId = generateEmojiId(groupId.substring(6), i)

      const task = {
        taskId,
        filePath,
        fileName,
        ext,
        buffer,
        size: buffer.length,
        mimeType: mimeTypeForExt(ext),
        emojiId,
        groupId,
        packet: packetIndex++,
        retryCount: 0,
        status: 'pending'
      }

      this.pendingFiles.set(taskId, task)
      tasks.push({
        taskId,
        filename: fileName,
        mimeType: task.mimeType,
        size: buffer.length
      })
    }

    // 分批上传（避免一次性发送太多数据）
    const BATCH_SIZE = 10
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE)
      await this.uploadBatch(batch)
      
      // 如果触发了速率限制，等待
      if (Date.now() < this.rateLimitUntil) {
        const waitTime = this.rateLimitUntil - Date.now()
        console.error(`Rate limit triggered, waiting ${Math.ceil(waitTime / 1000)}s...`)
        await sleep(waitTime)
      }
    }

    // 合并已存在的和新增的表情数据
    const allEmojis = [...existingEmojiMap.values(), ...this.uploadedFiles]
    return {
      uploaded: allEmojis,
      failed: this.failedFiles,
      skipped: existingEmojiMap.size
    }
  }

  async uploadBatch(tasks) {
    if (tasks.length === 0) return

    // 发送任务列表（二进制模式）
    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_TASKS',
        sessionId: this.sessionId,
        tasks,
        binaryMode: true
      })
    )

    // 发送二进制数据
    for (const task of tasks) {
      const fileData = this.pendingFiles.get(task.taskId)
      console.error(`Sending binary: ${fileData.fileName} (${fileData.size} bytes)`)

      const taskIdBuffer = Buffer.from(task.taskId, 'utf8')
      const lengthBuffer = Buffer.alloc(4)
      lengthBuffer.writeUInt32BE(taskIdBuffer.length, 0)
      const frame = Buffer.concat([lengthBuffer, taskIdBuffer, fileData.buffer])
      this.ws.send(frame)
    }

    // 等待该批次完成
    return new Promise((resolve, reject) => {
      const batchTaskIds = new Set(tasks.map(t => t.taskId))
      
      const checkComplete = () => {
        let allDone = true
        for (const taskId of batchTaskIds) {
          if (this.pendingFiles.has(taskId)) {
            allDone = false
            break
          }
        }
        if (allDone) {
          resolve()
        }
      }

      const timeout = setTimeout(() => {
        reject(new Error('Batch upload timeout'))
      }, 30 * 60 * 1000)

      // 覆盖原有的 onUploadComplete，使用批次特定的处理
      const originalOnUploadComplete = this.onUploadComplete
      this.onUploadComplete = () => {
        clearTimeout(timeout)
        resolve()
        // 恢复原来的处理器
        this.onUploadComplete = originalOnUploadComplete
      }
    })
  }

  handleMessage(raw) {
    if (typeof raw !== 'string') {
      raw = raw.toString('utf8')
    }

    let data
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }

    if (data.type === 'SESSION_CREATED') {
      this.sessionId = data.sessionId
      if (data.serverStats) {
        this.serverStats = data.serverStats
      }
      console.error(`Session created: ${this.sessionId}`)
      return
    }

    if (data.type === 'STATS_UPDATE') {
      this.serverStats = data.stats
      return
    }

    if (data.type === 'TASK_COMPLETED') {
      const taskId = data.taskId
      const task = this.pendingFiles.get(taskId)

      if (!task) {
        console.error(`Warning: Unknown task completed: ${taskId}`)
        return
      }

      console.error(`[TASK_COMPLETED] ${task.fileName} -> ${data.resultUrl}`)

      const result = data.result || {}
      const url = result.url || data.resultUrl

      let displayUrl = url
      if (result.thumbnail) {
        displayUrl = result.thumbnail
      } else if (result.thumbnail_width && result.thumbnail_height) {
        displayUrl = result.short_url || result.short_path || getThumbnailUrl(url, this.thumbnailSize)
      } else {
        displayUrl = getThumbnailUrl(url, this.thumbnailSize)
      }

      const emoji = {
        id: task.emojiId,
        name: path.basename(task.fileName, task.ext),
        url: url,
        displayUrl: displayUrl,
        width: result.width,
        height: result.height,
        thumbnail_width: result.thumbnail_width || this.thumbnailSize,
        thumbnail_height: result.thumbnail_height || this.thumbnailSize,
        filesize: result.filesize || task.size,
        human_filesize: result.human_filesize || formatFileSize(task.size),
        extension: result.extension || task.ext.substring(1),
        short_url: result.short_url || null,
        short_path: result.short_path || null,
        dominant_color: result.dominant_color || null,
        groupId: task.groupId,
        packet: task.packet
      }

      this.uploadedFiles.push(emoji)
      this.pendingFiles.delete(taskId)

      // 触发完成回调
      if (this.onUploadComplete) {
        this.onUploadComplete()
      }
    }

    if (data.type === 'TASK_FAILED') {
      const taskId = data.taskId
      const task = this.pendingFiles.get(taskId)

      if (!task) {
        console.error(`Warning: Unknown task failed: ${taskId}`)
        return
      }

      task.retryCount++
      const error = data.error

      // 检查是否应该重试
      if (task.retryCount < this.maxRetries) {
        const isRateLimit = error.includes('429') || error.toLowerCase().includes('rate limit')

        if (isRateLimit) {
          // 429 错误，设置速率限制
          const waitSeconds = this.extractWaitSeconds(error)
          const waitTime = waitSeconds ? waitSeconds * 1000 : this.retryDelay * Math.pow(2, task.retryCount)
          this.rateLimitUntil = Date.now() + waitTime
          
          console.error(`[TASK_FAILED] ${task.fileName}: ${error} (Rate limit, waiting ${Math.ceil(waitTime / 1000)}s, retry ${task.retryCount}/${this.maxRetries})`)
          
          // 暂时移除任务，等待后重新提交
          this.pendingFiles.delete(taskId)
          setTimeout(() => {
            task.status = 'pending'
            this.pendingFiles.set(taskId, task)
            this.resubmitTask(task)
          }, waitTime)
        } else {
          // 其他错误，使用指数退避
          const waitTime = this.retryDelay * Math.pow(2, task.retryCount)
          console.error(`[TASK_FAILED] ${task.fileName}: ${error} (Retry ${task.retryCount}/${this.maxRetries} in ${waitTime}ms)`)
          
          this.pendingFiles.delete(taskId)
          setTimeout(() => {
            task.status = 'pending'
            this.pendingFiles.set(taskId, task)
            this.resubmitTask(task)
          }, waitTime)
        }
      } else {
        // 超过最大重试次数，标记为失败
        console.error(`[TASK_FAILED] ${task.fileName}: ${error} (Max retries exceeded)`)
        
        this.failedFiles.push({
          fileName: task.fileName,
          filePath: task.filePath,
          error: error,
          retryCount: task.retryCount,
          timestamp: new Date().toISOString()
        })

        this.pendingFiles.delete(taskId)
      }

      // 触发完成回调
      if (this.onUploadComplete) {
        this.onUploadComplete()
      }
    }

    if (data.type === 'TASK_WAITING') {
      const taskId = data.taskId
      const task = this.pendingFiles.get(taskId)
      
      if (task) {
        const waitTime = data.waitTime * 1000
        this.rateLimitUntil = Date.now() + waitTime
        console.error(`[TASK_WAITING] ${task.fileName} waiting ${data.waitTime}s...`)
      }
    }

    if (data.type === 'SESSION_COMPLETED') {
      console.error(`Session completed: ${data.stats.completed} succeeded, ${data.stats.failed} failed`)
    }
  }

  resubmitTask(task) {
    if (!this.ws || !this.sessionId) {
      console.error(`Cannot resubmit task ${task.fileName}: not connected`)
      return
    }

    const taskPayload = {
      taskId: task.taskId,
      filename: task.fileName,
      mimeType: task.mimeType,
      size: task.size
    }

    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_TASKS',
        sessionId: this.sessionId,
        tasks: [taskPayload],
        binaryMode: true
      })
    )

    const taskIdBuffer = Buffer.from(task.taskId, 'utf8')
    const lengthBuffer = Buffer.alloc(4)
    lengthBuffer.writeUInt32BE(taskIdBuffer.length, 0)
    const frame = Buffer.concat([lengthBuffer, taskIdBuffer, task.buffer])
    this.ws.send(frame)
  }

  extractWaitSeconds(error) {
    const match = error.match(/wait[ _-]?seconds?[ :=](\d+)/i)
    if (match) {
      return Number.parseInt(match[1], 10)
    }
    return null
  }
}

// ==================== 主程序 ====================

async function main() {
  const args = parseArgs(process.argv.slice(2))

  console.error('Arguments:', {
    folder: args.folder,
    groupName: args.groupName,
    server: args.server,
    thumbnailSize: args.thumbnailSize,
    outputFile: args.outputFile,
    logFile: args.logFile,
    resume: args.resume,
    maxRetries: args.maxRetries,
    retryDelay: args.retryDelay
  })

  // 列出图片文件
  const imageFiles = listImageFiles(args.folder)
  if (imageFiles.length === 0) {
    console.error(`No image files found in: ${args.folder}`)
    process.exit(1)
  }

  console.error(`Found ${imageFiles.length} image file(s)`)
  console.error(`Output file: ${args.outputFile}`)

  // 如果输出文件已存在，自动启用断点续传
  let existingEmojiMap = new Map()
  if (fs.existsSync(args.outputFile)) {
    if (!args.resume) {
      console.error(`Warning: Output file ${args.outputFile} already exists, enabling resume mode`)
      args.resume = true
    }
    existingEmojiMap = loadExistingEmojiData(args.outputFile)
    console.error(`Loaded ${existingEmojiMap.size} existing emoji(s) from ${args.outputFile}`)
  }

  // 连接到服务器
  const client = new UploadClient(args.server, {
    thumbnailSize: args.thumbnailSize,
    maxRetries: args.maxRetries,
    retryDelay: args.retryDelay
  })

  try {
    await client.connect()
  } catch (err) {
    console.error('Failed to connect to server:', err.message)
    process.exit(1)
  }

  // 上传文件
  try {
    const result = await client.uploadFiles(imageFiles, existingEmojiMap)

    // 断开连接
    client.disconnect()

    const uploadedCount = result.uploaded.length
    const failedCount = result.failed.length
    const skippedCount = result.skipped

    console.error(`\nUpload completed: ${uploadedCount} total, ${uploadedCount - skippedCount} new, ${skippedCount} skipped, ${failedCount} failed`)

    // 保存表情数据到文件
    saveEmojiData(args.outputFile, result.uploaded)
    console.error(`Emoji data saved to: ${args.outputFile}`)

    // 写入失败日志
    if (failedCount > 0) {
      const logFilePath = args.logFile || args.outputFile.replace(/\.json$/, '-failed.log')
      const logContent = [
        '# Upload Failure Log',
        `# Generated: ${new Date().toISOString()}`,
        `# Folder: ${args.folder}`,
        `# Group: ${args.groupName}`,
        `# Total: ${imageFiles.length}, Succeeded: ${uploadedCount - failedCount}, Failed: ${failedCount}`,
        '',
        ...result.failed.map(f => {
          const fileIndex = imageFiles.indexOf(f.filePath) + 1
          return `[${fileIndex}/${imageFiles.length}] ${f.fileName}`
            + `\n  Path: ${f.filePath}`
            + `\n  Error: ${f.error}`
            + `\n  Retries: ${f.retryCount}`
            + `\n  Time: ${f.timestamp}`
        })
      ].join('\n')

      fs.writeFileSync(logFilePath, logContent, 'utf8')
      console.error(`Failed files logged to: ${logFilePath}`)
    }
  } catch (err) {
    console.error('Upload failed:', err.message)
    client.disconnect()
    process.exit(1)
  }
}

// 运行主程序
main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})