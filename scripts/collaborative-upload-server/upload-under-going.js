#!/usr/bin/env node
/**
 * Upload AVIF files and generate market JSON.
 */

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import WebSocket from 'ws'
import {
  ensureCommand,
  ensureDir,
  listGroupDirs,
  mimeTypeForExt,
  appendProgress,
  readProgressLog,
  getImageSize
} from './processing-utils.js'

const DEFAULT_WORK_DIR = path.resolve(process.cwd(), 'scripts/under_going/.work')
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/cfworker/public/assets/market')
const DEFAULT_SERVER = 'ws://localhost:9527'

function parseArgs(argv) {
  const args = {
    server: DEFAULT_SERVER,
    workdir: DEFAULT_WORK_DIR,
    output: DEFAULT_OUTPUT_DIR,
    batch: null,
    progressLog: null
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--server':
        args.server = argv[++i]
        break
      case '--workdir':
        args.workdir = path.resolve(process.cwd(), argv[++i])
        break
      case '--output':
        args.output = path.resolve(process.cwd(), argv[++i])
        break
      case '--batch':
        args.batch = Number.parseInt(argv[++i], 10)
        break
      case '--progress-log':
        args.progressLog = path.resolve(process.cwd(), argv[++i])
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
  console.log('Starting upload-under-going with args:', args)

  ensureCommand('magick', 'Install ImageMagick (magick command) for size detection.')
  ensureDir(args.output)
  ensureDir(args.workdir)

  const progress = readProgressLog(args.progressLog)
  const existingGroupIds = loadExistingGroupIds(args.output)
  const groupDirs = listGroupDirs(args.workdir)
  if (groupDirs.length === 0) {
    console.log(`No group directories found in ${args.workdir}`)
    return
  }

  let client = null
  let batchSize = args.batch && args.batch > 0 ? args.batch : 0

  for (const groupDir of groupDirs) {
    const groupName = path.basename(groupDir)
    const avifDir = path.join(groupDir, 'avif')
    if (!fs.existsSync(avifDir)) continue

    const avifFiles = fs
      .readdirSync(avifDir)
      .filter(name => name.toLowerCase().endsWith('.avif'))
      .map(name => path.join(avifDir, name))

    if (avifFiles.length === 0) {
      console.warn(`No AVIF files found in ${avifDir}, skipping.`)
      continue
    }

    const files = avifFiles.map(filePath => {
      const name = path.basename(filePath)
      const key = `${groupName}::${name}`
      const uploadedRecord = progress.uploaded.get(key)
      const size = fs.statSync(filePath).size
      const convertRecord = progress.converted.get(key)
      const width = convertRecord?.width ?? null
      const height = convertRecord?.height ?? null
      return {
        key,
        name,
        path: filePath,
        size: convertRecord?.size || size,
        width,
        height,
        url: uploadedRecord?.url || null,
        attempts: 0
      }
    })

    const uploadQueue = files.filter(file => !file.url)
    if (uploadQueue.length === 0) {
      console.log(`All files already uploaded for ${groupName}, skipping upload.`)
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
        `Uploading ${batch.length} file(s) for ${groupName} (remaining: ${
          uploadQueue.length
        })`
      )

      const batchFiles = batch.map(file => ({
        taskId: randomUUID(),
        name: file.name,
        size: file.size,
        buffer: fs.readFileSync(file.path),
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

    const completedUploads = files.filter(file => file.url)
    if (completedUploads.length === 0) {
      console.warn(`No uploads succeeded for ${groupName}, skipping JSON.`)
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
      let width = file.width
      let height = file.height
      if (!width || !height) {
        const dims = getImageSize(file.path)
        width = dims.width
        height = dims.height
      }
      const emoji = {
        id: emojiId,
        packet,
        name: file.name,
        url: file.url,
        groupId
      }
      if (width && height) {
        emoji.width = width
        emoji.height = height
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
  }

  if (client) {
    client.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
