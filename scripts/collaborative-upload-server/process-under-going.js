#!/usr/bin/env node
/**
 * Batch unzip -> AVIF convert -> collaborative upload -> market JSON generator.
 *
 * Usage:
 *   node scripts/collaborative-upload-server/process-under-going.js \
 *     --server ws://localhost:9527 \
 *     --input scripts/under_going \
 *     --output scripts/cfworker/public/assets/market
 */

import fs from 'fs'
import path from 'path'
import { spawn, spawnSync } from 'child_process'
import { randomUUID } from 'crypto'
import WebSocket from 'ws'

const DEFAULT_INPUT_DIR = path.resolve(process.cwd(), 'scripts/under_going')
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/cfworker/public/assets/market')
const DEFAULT_WORK_DIR = path.resolve(process.cwd(), 'scripts/under_going/.work')
const DEFAULT_SERVER = 'ws://localhost:9527'
const DEFAULT_QUALITY = 80
const DEFAULT_AVIF_SPEED = 6
const DEFAULT_AVIF_JOBS = 1
const DEFAULT_CONVERT_CONCURRENCY = 12

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.avif'
])

function parseArgs(argv) {
  const args = {
    server: DEFAULT_SERVER,
    input: DEFAULT_INPUT_DIR,
    output: DEFAULT_OUTPUT_DIR,
    workdir: DEFAULT_WORK_DIR,
    quality: DEFAULT_QUALITY,
    avifSpeed: DEFAULT_AVIF_SPEED,
    avifJobs: DEFAULT_AVIF_JOBS,
    convertConcurrency: DEFAULT_CONVERT_CONCURRENCY,
    batch: null,
    keepTemp: false,
    progressLog: null
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--server':
        args.server = argv[++i]
        break
      case '--input':
        args.input = path.resolve(process.cwd(), argv[++i])
        break
      case '--output':
        args.output = path.resolve(process.cwd(), argv[++i])
        break
      case '--workdir':
        args.workdir = path.resolve(process.cwd(), argv[++i])
        break
      case '--quality':
        args.quality = Number.parseInt(argv[++i], 10)
        break
      case '--avif-speed':
        args.avifSpeed = Number.parseInt(argv[++i], 10)
        break
      case '--avif-jobs':
        args.avifJobs = Number.parseInt(argv[++i], 10)
        break
      case '--convert-concurrency':
        args.convertConcurrency = Number.parseInt(argv[++i], 10)
        break
      case '--batch':
        args.batch = Number.parseInt(argv[++i], 10)
        break
      case '--progress-log':
        args.progressLog = path.resolve(process.cwd(), argv[++i])
        break
      case '--keep-temp':
        args.keepTemp = true
        break
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option ignored: ${arg}`)
        }
        break
    }
  }

  return args
}

function ensureCommand(cmd, hint) {
  const result = spawnSync('bash', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' })
  if (result.status !== 0) {
    throw new Error(`Missing required command: ${cmd}. ${hint}`)
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function listZipFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(name => name.toLowerCase().endsWith('.zip'))
    .map(name => path.join(dir, name))
}

function listImageFiles(dir) {
  const results = []
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
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

function unzipToDir(zipPath, destDir) {
  ensureDir(destDir)
  console.log(`Unzipping: ${zipPath} -> ${destDir}`)
  const result = spawnSync('unzip', ['-q', '-o', zipPath, '-d', destDir], {
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(`Failed to unzip: ${zipPath}`)
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed: ${command} ${args.join(' ')}`))
    })
  })
}

async function convertToAvif(inputPath, outputPath, quality, speed, jobs) {
  ensureDir(path.dirname(outputPath))
  console.log(`Converting: ${inputPath} -> ${outputPath}`)
  await runCommand(
    'avifenc',
    [
      '--quality',
      String(quality),
      '--speed',
      String(speed),
      '--jobs',
      String(jobs),
      inputPath,
      outputPath
    ],
    { stdio: 'inherit' }
  )
}

async function convertGifToAvif(inputPath, outputPath) {
  ensureDir(path.dirname(outputPath))
  console.log(`Converting GIF (animated) via ffmpeg: ${inputPath} -> ${outputPath}`)
  await runCommand(
    'ffmpeg',
    ['-i', inputPath, '-c:v', 'libaom-av1', '-crf', '30', '-b:v', '0', '-fps_mode', 'passthrough', '-y', outputPath],
    { stdio: 'inherit' }
  )
}

async function copyFile(inputPath, outputPath) {
  ensureDir(path.dirname(outputPath))
  console.log(`Copying AVIF: ${inputPath} -> ${outputPath}`)
  await fs.promises.copyFile(inputPath, outputPath)
}

function getImageSize(inputPath) {
  const result = spawnSync('magick', ['identify', '-format', '%w %h', inputPath], {
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    return { width: null, height: null }
  }
  const [w, h] = String(result.stdout || '').trim().split(/\s+/)
  const width = Number.parseInt(w, 10)
  const height = Number.parseInt(h, 10)
  if (Number.isNaN(width) || Number.isNaN(height)) {
    return { width: null, height: null }
  }
  return { width, height }
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

function appendProgress(logPath, payload) {
  if (!logPath) return
  fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8')
}

function readProgressLog(logPath) {
  const converted = new Map()
  const uploaded = new Map()
  if (!logPath || !fs.existsSync(logPath)) return { converted, uploaded }
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const data = JSON.parse(trimmed)
      if (data.type === 'convert' && data.key) {
        converted.set(data.key, data)
      }
      if (data.type === 'upload' && data.key && data.url) {
        uploaded.set(data.key, data)
      }
    } catch {
      // ignore invalid lines
    }
  }
  return { converted, uploaded }
}

function safeFileStem(relativePath) {
  return relativePath.replace(/[\\/]/g, '_').replace(/\s+/g, '_')
}

function sanitizeGroupName(name) {
  return name.replace(/\.zip$/i, '').trim()
}

function loadExistingGroupIds(outputDir) {
  if (!fs.existsSync(outputDir)) return new Set()
  const ids = new Set()
  const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.json'))
  for (const file of files) {
    if (file === 'metadata.json') continue
    try {
      const content = fs.readFileSync(path.join(outputDir, file), 'utf8')
      const data = JSON.parse(content)
      if (data && data.id) ids.add(data.id)
    } catch {
      // ignore invalid files
    }
  }
  return ids
}

async function runWithConcurrency(items, limit, handler) {
  const results = []
  let index = 0

  async function worker(workerId) {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      const item = items[currentIndex]
      const result = await handler(item, currentIndex, workerId)
      results[currentIndex] = result
    }
  }

  const workers = []
  const workerCount = Math.max(1, limit)
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker(i))
  }
  await Promise.all(workers)
  return results
}

class CollaborativeMasterClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl
    this.ws = null
    this.sessionId = null
    this.serverStats = null
    this.currentBatch = null
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to collaborative server: ${this.serverUrl}`)
      const ws = new WebSocket(this.serverUrl)
      this.ws = ws
      ws.on('open', () => {
        console.log('WebSocket connected, creating session...')
        ws.send(JSON.stringify({ type: 'CREATE_SESSION', uuid: randomUUID() }))
      })
      ws.on('message', data => {
        this.handleMessage(data)
        if (this.sessionId) resolve()
      })
      ws.on('error', err => {
        console.error('WebSocket error:', err)
        reject(err)
      })
      ws.on('close', () => {
        console.warn('WebSocket closed')
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

  getStats(timeoutMs = 5000) {
    return new Promise(resolve => {
      if (!this.ws) return resolve(null)
      const handler = data => {
        let parsed = null
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data)
          } catch {
            parsed = null
          }
        } else if (data) {
          try {
            parsed = JSON.parse(data.toString('utf8'))
          } catch {
            parsed = null
          }
        }

        if (parsed?.type === 'STATS_UPDATE') {
          this.serverStats = parsed.stats
          this.ws.off('message', handler)
          resolve(parsed.stats)
        }
      }
      this.ws.on('message', handler)
      this.ws.send(JSON.stringify({ type: 'GET_STATS' }))
      setTimeout(() => {
        if (!this.ws) return
        this.ws.off('message', handler)
        console.warn('Timed out waiting for server stats.')
        resolve(null)
      }, timeoutMs)
    })
  }

  async uploadBatch(files) {
    if (!this.ws || !this.sessionId) {
      throw new Error('Not connected to collaborative server')
    }

    console.log(
      `Uploading batch (${files.length} files): ${files.map(file => file.name).join(', ')}`
    )

    const tasks = files.map(file => {
      const ext = path.extname(file.name).toLowerCase()
      return {
        taskId: file.taskId,
        filename: file.name,
        mimeType: mimeTypeForExt(ext),
        size: file.size
      }
    })

    this.currentBatch = {
      taskMap: new Map(files.map(file => [file.taskId, file])),
      results: [],
      remaining: files.length,
      resolve: null
    }

    const batchPromise = new Promise(resolve => {
      this.currentBatch.resolve = resolve
    })

    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_TASKS',
        sessionId: this.sessionId,
        tasks,
        binaryMode: true
      })
    )

    for (const file of files) {
      console.log(`Sending binary: ${file.name} (${file.size} bytes)`)
      const taskIdBuffer = Buffer.from(file.taskId, 'utf8')
      const lengthBuffer = Buffer.alloc(4)
      lengthBuffer.writeUInt32BE(taskIdBuffer.length, 0)
      const frame = Buffer.concat([lengthBuffer, taskIdBuffer, file.buffer])
      this.ws.send(frame)
    }

    return batchPromise
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
      console.log(`Session created: ${this.sessionId}`)
      return
    }

    if (data.type === 'STATS_UPDATE') {
      this.serverStats = data.stats
      return
    }

    if (!this.currentBatch) return

    if (data.type === 'TASK_COMPLETED' || data.type === 'TASK_FAILED') {
      const taskId = data.taskId
      if (!this.currentBatch.taskMap.has(taskId)) return
      const file = this.currentBatch.taskMap.get(taskId)
      console.log(
        `[${data.type}] ${file.name}${data.resultUrl ? ` -> ${data.resultUrl}` : ''}${
          data.error ? ` (${data.error})` : ''
        }`
      )
      this.currentBatch.taskMap.delete(taskId)
      this.currentBatch.remaining -= 1

      this.currentBatch.results.push({
        file,
        success: data.type === 'TASK_COMPLETED',
        url: data.resultUrl || null,
        error: data.error || null
      })

      if (this.currentBatch.remaining <= 0 && this.currentBatch.resolve) {
        const results = this.currentBatch.results
        const resolve = this.currentBatch.resolve
        this.currentBatch = null
        resolve(results)
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.progressLog) {
    args.progressLog = path.join(args.workdir, 'progress.log')
  }
  console.log('Starting process-under-going with args:', args)

  ensureCommand('unzip', 'Install unzip (e.g. apt install unzip).')
  ensureCommand('magick', 'Install ImageMagick (magick command) for size detection.')
  ensureCommand('avifenc', 'Install libavif (avifenc command) for AVIF conversion.')
  ensureCommand('ffmpeg', 'Install ffmpeg for animated GIF conversion.')

  ensureDir(args.output)
  ensureDir(args.workdir)

  const zipFiles = listZipFiles(args.input)
  if (zipFiles.length === 0) {
    console.log(`No zip files found in ${args.input}`)
    return
  }
  console.log(`Found ${zipFiles.length} zip file(s) in ${args.input}`)

  const existingGroupIds = loadExistingGroupIds(args.output)
  const progress = readProgressLog(args.progressLog)

  let client = null
  let batchSize = args.batch && args.batch > 0 ? args.batch : 0

  for (const zipPath of zipFiles) {
    const zipName = path.basename(zipPath)
    const groupName = sanitizeGroupName(zipName)
    const groupBaseDir = path.join(args.workdir, groupName)
    const extractDir = path.join(groupBaseDir, 'extract')
    const avifDir = path.join(groupBaseDir, 'avif')

    if (fs.existsSync(groupBaseDir)) {
      fs.rmSync(groupBaseDir, { recursive: true, force: true })
    }

    console.log(`\nProcessing ${zipName}`)
    unzipToDir(zipPath, extractDir)

    const imageFiles = listImageFiles(extractDir)
    if (imageFiles.length === 0) {
      console.warn(`No images found in ${zipName}, skipping.`)
      continue
    }

    const conversionTasks = imageFiles.map(imagePath => {
      const relativePath = path.relative(extractDir, imagePath)
      const ext = path.extname(imagePath).toLowerCase()
      const stem = safeFileStem(relativePath.replace(/\.[^.]+$/, ''))
      const outputName = `${stem}.avif`
      const outputPath = path.join(avifDir, outputName)
      const key = `${zipName}::${relativePath}`
      return { imagePath, relativePath, ext, outputPath, outputName, key }
    })

    console.log(
      `Converting ${conversionTasks.length} image(s) with concurrency ${args.convertConcurrency} (avifenc jobs: ${args.avifJobs})`
    )

    const convertedFiles = await runWithConcurrency(
      conversionTasks,
      args.convertConcurrency,
      async task => {
        const uploadedRecord = progress.uploaded.get(task.key)
        if (uploadedRecord?.url) {
          return {
            sourcePath: task.imagePath,
            avifPath: task.outputPath,
            name: task.outputName,
            size: uploadedRecord.size || 0,
            width: uploadedRecord.width || null,
            height: uploadedRecord.height || null,
            attempts: 0,
            url: uploadedRecord.url,
            key: task.key
          }
        }

        const convertRecord = progress.converted.get(task.key)
        const hasConverted = convertRecord && fs.existsSync(task.outputPath)

        if (hasConverted) {
          console.log(`Skipping conversion (cached): ${task.relativePath}`)
        } else {
          console.log(`Converting: ${task.relativePath}`)
          if (task.ext === '.avif') {
            await copyFile(task.imagePath, task.outputPath)
          } else if (task.ext === '.gif') {
            await convertGifToAvif(task.imagePath, task.outputPath)
          } else {
            await convertToAvif(
              task.imagePath,
              task.outputPath,
              args.quality,
              args.avifSpeed,
              args.avifJobs
            )
          }
        }

        const size = fs.existsSync(task.outputPath) ? fs.statSync(task.outputPath).size : 0
        const dimensions = fs.existsSync(task.outputPath)
          ? getImageSize(task.outputPath)
          : { width: null, height: null }

        appendProgress(args.progressLog, {
          type: 'convert',
          key: task.key,
          outputName: task.outputName,
          outputPath: task.outputPath,
          size,
          width: dimensions.width,
          height: dimensions.height
        })

        return {
          sourcePath: task.imagePath,
          avifPath: task.outputPath,
          name: task.outputName,
          size,
          width: dimensions.width,
          height: dimensions.height,
          attempts: 0,
          url: null,
          key: task.key
        }
      }
    )

    const uploadQueue = convertedFiles.filter(file => !file.url)
    if (uploadQueue.length === 0) {
      console.log(`All files already uploaded for ${zipName}, skipping upload.`)
    }

    if (uploadQueue.length > 0 && !client) {
      client = new CollaborativeMasterClient(args.server)
      await client.connect()
      const stats = await client.getStats()
      const effectiveStats = stats || client.serverStats
      const workerCount = effectiveStats?.workerCount || 0

      if (workerCount <= 0 && !args.batch) {
        throw new Error('No workers connected to collaborative server. Connect workers first.')
      }

      batchSize = args.batch && args.batch > 0 ? args.batch : workerCount
      console.log(`Using batch size: ${batchSize}`)
    }

    while (uploadQueue.length > 0) {
      const batch = uploadQueue.splice(0, batchSize)
      console.log(
        `Uploading ${batch.length} file(s) for ${zipName} (remaining: ${
          uploadQueue.length
        })`
      )
      const batchFiles = batch.map(file => ({
        taskId: randomUUID(),
        name: file.name,
        size: file.size,
        buffer: fs.readFileSync(file.avifPath),
        meta: file
      }))

      const results = await client.uploadBatch(batchFiles)

      for (const result of results) {
        const meta = result.file.meta
        meta.attempts += 1
        if (result.success) {
          meta.url = result.url
          appendProgress(args.progressLog, {
            type: 'upload',
            key: meta.key,
            outputName: meta.name,
            url: meta.url,
            size: meta.size,
            width: meta.width,
            height: meta.height
          })
        } else if (meta.attempts < 3) {
          console.warn(`Retrying ${meta.name} (attempt ${meta.attempts + 1}/3)`)
          uploadQueue.push(meta)
        } else {
          console.warn(`Failed after 3 attempts: ${meta.name}`)
        }
      }
    }

    const completedUploads = convertedFiles.filter(file => file.url)
    if (completedUploads.length === 0) {
      console.warn(`No uploads succeeded for ${zipName}, skipping JSON.`)
      continue
    }

    let groupId = `group-${Date.now()}`
    while (existingGroupIds.has(groupId)) {
      groupId = `group-${Date.now() + Math.floor(Math.random() * 1000)}`
    }
    existingGroupIds.add(groupId)

    const emojis = completedUploads.map(file => {
      const packet = Date.now()
      const emojiId = `emoji-${packet}-${Math.random().toString(36).slice(2, 8)}`
      const emoji = {
        id: emojiId,
        packet,
        name: file.name,
        url: file.url,
        groupId
      }
      if (file.width && file.height) {
        emoji.width = file.width
        emoji.height = file.height
      }
      return emoji
    })

    const iconIndex = Math.floor(Math.random() * completedUploads.length)
    const groupJson = {
      id: groupId,
      name: groupName,
      icon: completedUploads[iconIndex].url,
      order: 0,
      emojis
    }

    const outFile = path.join(args.output, `group-${groupId}.json`)
    fs.writeFileSync(outFile, JSON.stringify(groupJson, null, 2))
    console.log(`Wrote group JSON: ${outFile}`)

    if (!args.keepTemp) {
      fs.rmSync(groupBaseDir, { recursive: true, force: true })
    }
  }

  if (client) {
    client.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
