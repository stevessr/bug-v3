#!/usr/bin/env node
// 跨平台构建脚本
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// 检测可用的包管理器
function detectPackageManager() {
  try {
    execSync('pnpm --version', { stdio: 'ignore' })
    return 'pnpm'
  } catch {
    try {
      execSync('npm --version', { stdio: 'ignore' })
      return 'npm'
    } catch {
      throw new Error('Neither pnpm nor npm found. Please install a package manager.')
    }
  }
}

const PKG_MANAGER = detectPackageManager()
console.log(`📦 Using package manager: ${PKG_MANAGER}`)

// 定义环境变量配置
const configs = {
  dev: {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'development'
  },

  build: {
    ENABLE_LOGGING: 'false', // 生产环境禁用日志
    NODE_ENV: 'production',
    BUILD_MINIFIER: 'esbuild'
  },

  'build:prod': {
    ENABLE_LOGGING: 'false',
    NODE_ENV: 'production',
    BUILD_MINIFIER: 'terser'
  },
  'build:minimal': {
    ENABLE_LOGGING: 'false',
    NODE_ENV: 'production',
    BUILD_MINIFIER: 'terser'
  },
  // 新增：仅编译、不混淆（调试用）
  'build:debug': {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'false',
    BUILD_FAST: 'true'
  }
}

// 解析命令行参数
const args = process.argv.slice(2)
// 移除变体选择功能：不再把首个参数解释为变体。
// 用法现在为：node scripts/build.js <buildType>
let buildType = 'dev'

if (args.length === 0) {
  buildType = 'dev'
} else {
  if (Object.prototype.hasOwnProperty.call(configs, args[0])) {
    buildType = args[0]
  } else {
    console.error(`未知的构建类型或不再支持变体参数：${args[0]}`)
    console.error(`可用的构建类型：${Object.keys(configs).join(', ')}`)
    process.exit(1)
  }
}

const config = configs[buildType]
if (!config) {
  console.error(`未知的构建类型：${buildType}`)
  console.error(`可用的构建类型：${Object.keys(configs).join(', ')}`)
  process.exit(1)
}

// 设置环境变量
Object.assign(process.env, config)

// Note: JSON asset preparation has been moved to a separate script.
// Run `node scripts/prepare-json-assets.js` to generate CloudFlare Worker JSON assets.
// This is only needed when updating defaultEmojiGroups for the CF Worker deployment.

// 打印配置信息
console.log(`🚀 开始构建 (${buildType})`)
console.log(`📋 配置:`)
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`)
})

// 检查命令行参数是否包含 --no-eslint
const skipEslint = args.includes('--no-eslint')

// Copy WASM files to public/wasm before build/dev starts
// This ensures they are available for both dev server and production build
try {
  const wasmSource = path.resolve(process.cwd(), 'scripts', 'wasm')
  const wasmPublicDest = path.resolve(process.cwd(), 'public', 'wasm')

  if (fs.existsSync(wasmSource)) {
    if (!fs.existsSync(wasmPublicDest)) {
      fs.mkdirSync(wasmPublicDest, { recursive: true })
    }

    const files = ['perceptual_hash.js', 'perceptual_hash.wasm']
    let copiedCount = 0

    files.forEach(file => {
      const srcPath = path.join(wasmSource, file)
      const destPath = path.join(wasmPublicDest, file)

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath)
        copiedCount++
      }
    })

    if (copiedCount > 0) {
      console.log(`✨ Pre-copied ${copiedCount} WASM files to public/wasm/`)
    }
  }
} catch (e) {
  console.warn('⚠️ Failed to pre-copy WASM files:', e)
}

// 执行 vite（开发或构建）
// 构建时传递给 `vite` 的参数数组。dev 模式不传额外参数（等价于 `pnpm exec vite`）。
const viteArgs = buildType === 'dev' ? [] : ['build']

const child = spawn(PKG_MANAGER, ['exec', 'vite', ...viteArgs], {
  stdio: 'inherit',
  env: { ...process.env, SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT },
  shell: false
})

child.on('exit', code => {
  if (code === 0 && buildType !== 'dev') {
    console.log('✅ Build completed!')
  }
  process.exit(code)
})
