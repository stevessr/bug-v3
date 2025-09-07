#!/usr/bin/env node

// 监视 src 目录的文件变动，触发构建 (使用 scripts/build.js build)
import { spawn } from 'child_process'
import fs, { watch } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import ignore from 'ignore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

const srcDir = path.join(projectRoot, 'src')

// --- .gitignore 处理 ---
const ig = ignore()
const gitignorePath = path.join(projectRoot, '.gitignore')

try {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
  ig.add(gitignoreContent)
  console.log('✅ 已加载 .gitignore 规则')
} catch (err) {
  console.warn('⚠️ 未找到或无法读取 .gitignore 文件，将监视所有文件变动。')
}
// --- .gitignore 处理结束 ---

let buildProcess = null
let pendingRun = false
let debounceTimer = null
const DEBOUNCE_MS = 200

function startBuild() {
  if (buildProcess) {
    // 如果当前有构建在运行，标记为在结束后需要再跑一次
    pendingRun = true
    return
  }

  console.log('🔁 触发构建: node scripts/build.js build')
  buildProcess = spawn(process.execPath, [path.join(__dirname, 'build.js'), 'build'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
    cwd: projectRoot // 确保子进程工作目录是项目根目录
  })

  buildProcess.on('exit', code => {
    buildProcess = null
    console.log(`构建结束，退出码: ${code}`)
    if (pendingRun) {
      pendingRun = false
      // 小延迟以合并紧接的文件改动
      setTimeout(startBuild, 50)
    }
  })
}

console.log(`👀 正在监视: ${srcDir}（递归）`)

try {
  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return

    // 获取相对于项目根目录的路径，以便和 .gitignore 规则匹配
    const relativePath = path.join('src', filename)

    // 检查文件是否应该被忽略
    if (ig.ignores(relativePath)) {
      // console.log(`🙈 忽略: ${relativePath}`); // 如果需要调试，可以取消此行注释
      return
    }

    // 忽略临时/隐藏文件的噪声 (虽然 .gitignore 通常会包含这些)
    if (filename.startsWith('.') || filename.endsWith('~')) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => startBuild(), DEBOUNCE_MS)
  })

  process.on('SIGINT', () => {
    console.log('\n停止监视，退出。')
    watcher.close()
    if (buildProcess) {
      buildProcess.kill('SIGINT')
    }
    process.exit(0)
  })
} catch (err) {
  console.error('无法启动文件监视器:', err)
  console.error('你可以考虑安装 chokidar 并改用更可靠的实现。')
  process.exit(1)
}
