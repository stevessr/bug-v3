import fs from 'fs'
import path from 'path'
import { spawn, spawnSync } from 'child_process'

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

export function ensureCommand(cmd, hint) {
  const result = spawnSync('bash', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' })
  if (result.status !== 0) {
    throw new Error(`Missing required command: ${cmd}. ${hint}`)
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

export function listZipFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(name => name.toLowerCase().endsWith('.zip'))
    .map(name => path.join(dir, name))
}

export function listGroupDirs(workdir) {
  if (!fs.existsSync(workdir)) return []
  return fs
    .readdirSync(workdir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(workdir, entry.name))
}

export function listImageFiles(dir) {
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

export function getImageSize(inputPath) {
  const result = spawnSync('magick', ['identify', '-format', '%w %h', inputPath], {
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    return { width: null, height: null }
  }
  const [w, h] = String(result.stdout || '')
    .trim()
    .split(/\s+/)
  const width = Number.parseInt(w, 10)
  const height = Number.parseInt(h, 10)
  if (Number.isNaN(width) || Number.isNaN(height)) {
    return { width: null, height: null }
  }
  return { width, height }
}

export function mimeTypeForExt(ext) {
  if (ext === '.avif') return 'image/avif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff'
  return 'application/octet-stream'
}

export function appendProgress(logPath, payload) {
  if (!logPath) return
  fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8')
}

export function readProgressLog(logPath) {
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

export function safeFileStem(relativePath) {
  return relativePath.replace(/[\\/]/g, '_').replace(/\s+/g, '_')
}

export function sanitizeGroupName(name) {
  return name.replace(/\.zip$/i, '').trim()
}

export async function runWithConcurrency(items, limit, handler) {
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

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const wantsInherit = options.stdio === 'inherit'
    const spawnOptions = { ...options }
    if (!options.stdio || wantsInherit) {
      spawnOptions.stdio = ['ignore', 'pipe', 'pipe']
    }

    const child = spawn(command, args, spawnOptions)
    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', chunk => {
        const text = chunk.toString()
        stdout += text
        if (wantsInherit) process.stdout.write(text)
      })
    }

    if (child.stderr) {
      child.stderr.on('data', chunk => {
        const text = chunk.toString()
        stderr += text
        if (wantsInherit) process.stderr.write(text)
      })
    }

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      const stderrText = stderr.trim()
      const stdoutText = stdout.trim()
      const combined = stderrText || stdoutText
      const truncated =
        combined && combined.length > 4000 ? `${combined.slice(0, 4000)}\n...[truncated]` : combined
      const detail = truncated ? `\n${truncated}` : ''
      const signalText = signal ? ` (signal: ${signal})` : ''
      reject(
        new Error(
          `Command failed (exit: ${code})${signalText}: ${command} ${args.join(' ')}${detail}`
        )
      )
    })
  })
}
