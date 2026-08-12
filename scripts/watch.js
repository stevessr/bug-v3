#!/usr/bin/env node

// 使用 Vite 原生 build --watch，复用模块图并增量构建。
// 旧实现每次文件变动都会重新启动完整构建，迭代时浪费大量启动和解析时间。
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const buildProcess = spawn(
  process.execPath,
  [path.join(__dirname, 'build.js'), 'build:fast', '--watch'],
  {
    stdio: 'inherit',
    shell: false,
    env: process.env,
    cwd: projectRoot
  }
)

console.log('👀 Vite 增量构建监视已启动（pnpm watch）')

const stop = signal => {
  buildProcess.kill(signal)
}

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))

buildProcess.on('error', error => {
  console.error('❌ 无法启动增量构建：', error)
  process.exit(1)
})

buildProcess.on('exit', (code, signal) => {
  if (signal) {
    process.exit(0)
  }
  process.exit(code ?? 1)
})
