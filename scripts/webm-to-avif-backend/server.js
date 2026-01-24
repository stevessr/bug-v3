import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const DEFAULT_PORT = 8791
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024
const API_PATH = '/api/webm-to-avif'

const args = process.argv.slice(2)
const portIndex = args.findIndex(arg => arg === '--port')
const maxIndex = args.findIndex(arg => arg === '--max-bytes')
const PORT = portIndex >= 0 ? Number.parseInt(args[portIndex + 1], 10) : DEFAULT_PORT
const MAX_BYTES = maxIndex >= 0 ? Number.parseInt(args[maxIndex + 1], 10) : DEFAULT_MAX_BYTES

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  })
  res.end(body)
}

const runFfmpeg = (inputPath, outputPath) =>
  new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libaom-av1',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '32',
      '-b:v',
      '0',
      '-f',
      'avif',
      outputPath
    ]
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', err => reject(err))
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`))
    })
  })

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    send(res, 400, 'Invalid request')
    return
  }

  if (req.method === 'OPTIONS') {
    send(res, 204, '')
    return
  }

  if (req.method === 'GET') {
    if (req.url === '/' || req.url === '/health') {
      send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8' })
      return
    }
  }

  if (req.method !== 'POST' || !req.url.startsWith(API_PATH)) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' })
    return
  }

  let size = 0
  let aborted = false
  const chunks = []

  req.on('data', chunk => {
    size += chunk.length
    if (size > MAX_BYTES) {
      aborted = true
      req.destroy()
      send(res, 413, 'Payload too large')
      return
    }
    chunks.push(chunk)
  })

  req.on('end', async () => {
    if (aborted) return
    const inputBuffer = Buffer.concat(chunks)
    if (!inputBuffer.length) {
      send(res, 400, 'Empty request body')
      return
    }

    const tempId = randomUUID()
    const inputPath = path.join(os.tmpdir(), `webm-to-avif-${tempId}.webm`)
    const outputPath = path.join(os.tmpdir(), `webm-to-avif-${tempId}.avif`)

    try {
      await fs.writeFile(inputPath, inputBuffer)
      await runFfmpeg(inputPath, outputPath)

      const outputBuffer = await fs.readFile(outputPath)
      send(res, 200, outputBuffer, { 'Content-Type': 'image/avif' })
    } catch (error) {
      send(res, 500, `Conversion failed: ${error.message}`)
    } finally {
      await fs.unlink(inputPath).catch(() => {})
      await fs.unlink(outputPath).catch(() => {})
    }
  })
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WebM -> AVIF backend listening on http://localhost:${PORT}${API_PATH}`)
})
