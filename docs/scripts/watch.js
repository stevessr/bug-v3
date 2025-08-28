#!/usr/bin/env node

// 监视 src 目录的文件变动，触发构建 (使用 scripts/build.js build)
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { watch } = fs

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')
const srcDir = path.join(rootDir, 'src')

// 构建状态管理
let buildProcess = null
let needsCompilation = false // 编译flag
let debounceTimer = null
const DEBOUNCE_MS = 200

// 读取并解析 .gitignore 文件
function loadGitignorePatterns() {
  const gitignorePath = path.join(rootDir, '.gitignore')
  const patterns = []

  try {
    const content = fs.readFileSync(gitignorePath, 'utf8')
    content.split('\n').forEach((line) => {
      line = line.trim()
      // 跳过空行和注释
      if (line && !line.startsWith('#')) {
        // 简单的glob模式匹配 - 处理基本的gitignore规则
        patterns.push(line)
      }
    })
  } catch (err) {
    console.warn('无法读取 .gitignore 文件:', err.message)
  }

  return patterns
}

// 检查文件是否应该被忽略
function shouldIgnoreFile(relativePath, gitignorePatterns) {
  // 忽略临时/隐藏文件
  const filename = path.basename(relativePath)
  if (filename.startsWith('.') || filename.endsWith('~')) return true

  // 将路径标准化，统一使用正斜杠
  const normalizedPath = relativePath.replace(/\\/g, '/')

  // 检查gitignore模式
  for (const pattern of gitignorePatterns) {
    const normalizedPattern = pattern.replace(/\\/g, '/')

    // 简单的模式匹配 - 支持基本的通配符
    if (normalizedPattern.includes('*')) {
      const regex = new RegExp(normalizedPattern.replace(/\*/g, '.*').replace(/\//g, '\\/'))
      if (regex.test(normalizedPath)) return true
    } else {
      // 精确匹配或路径匹配
      if (
        normalizedPath === normalizedPattern ||
        normalizedPath.endsWith('/' + normalizedPattern)
      ) {
        return true
      }
    }
  }

  return false
}

function startBuild() {
  if (buildProcess) {
    // 如果正在构建，不需要设置flag，构建结束后会检查
    return
  }

  if (!needsCompilation) {
    // 没有需要编译的更改
    return
  }

  // 开始编译时立即清空flag
  needsCompilation = false
  console.log('🔁 开始构建: node scripts/build.js build (编译flag已清空)')

  buildProcess = spawn(process.execPath, [path.join(__dirname, 'build.js'), 'build'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })

  buildProcess.on('exit', (code) => {
    buildProcess = null
    console.log(`构建结束，退出码: ${code}`)

    // 构建结束后检查是否有新的更改需要编译
    if (needsCompilation) {
      console.log('检测到新的文件更改，准备下一次构建...')
      // 小延迟以合并可能的连续文件改动
      setTimeout(startBuild, 100)
    }
  })
}

// 文件变化处理函数
function handleFileChange(filename, gitignorePatterns) {
  if (!filename) return

  // 构建相对于项目根目录的路径
  const relativePath = path.join('src', filename).replace(/\\/g, '/')

  // 检查是否应该忽略这个文件
  if (shouldIgnoreFile(relativePath, gitignorePatterns)) {
    console.log(`🚫 忽略文件: ${relativePath}`)
    return
  }

  console.log(`📝 检测到文件变化: ${relativePath}`)

  // 设置需要编译的flag
  needsCompilation = true

  // 使用防抖来避免频繁触发构建
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => startBuild(), DEBOUNCE_MS)
}

// 主程序
async function main() {
  const gitignorePatterns = loadGitignorePatterns()
  console.log(`📋 加载了 ${gitignorePatterns.length} 个 gitignore 规则`)
  console.log(`👀 正在监视: ${srcDir}（递归）`)
  console.log('📍 编译flag机制已启用，避免重复编译问题')

  try {
    const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
      handleFileChange(filename, gitignorePatterns)
    })

    // 优雅退出处理
    process.on('SIGINT', () => {
      console.log('\n🛑 收到停止信号，正在清理...')

      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      if (buildProcess) {
        console.log('🔄 等待当前构建完成...')
        buildProcess.on('exit', () => {
          watcher.close()
          console.log('✅ 监视器已停止，退出。')
          process.exit(0)
        })
        // 如果构建进程没有响应，强制退出
        setTimeout(() => {
          buildProcess.kill('SIGKILL')
          watcher.close()
          process.exit(1)
        }, 5000)
      } else {
        watcher.close()
        console.log('✅ 监视器已停止，退出。')
        process.exit(0)
      }
    })

    // 处理其他错误信号
    process.on('SIGTERM', () => process.emit('SIGINT'))
  } catch (err) {
    console.error('❌ 无法启动文件监视器:', err)
    console.error('💡 建议: 考虑安装 chokidar 并改用更可靠的实现')
    process.exit(1)
  }
}

main().catch(console.error)
