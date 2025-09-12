#!/usr/bin/env node
// 跨平台构建脚本
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { gzipSync, constants as zlibConstants } from 'zlib'

// 定义环境变量配置
const configs = {
  dev: {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'development'
  },

  build: {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production'
  },

  'build:prod': {
    ENABLE_LOGGING: 'false',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production'
  },
  'build:no-indexeddb': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production'
  },
  'build:minimal': {
    ENABLE_LOGGING: 'false',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production'
  },
  'build:userscript': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'false'
  },
  'build:userscript:min': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'true'
  },
  // 新增：仅编译、不混淆（调试用）
  'build:debug': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'false'
  }
}

// 解析命令行参数
const args = process.argv.slice(2)
// 兼容两种用法：
// 1) node scripts/build.js build:userscript remote  （旧）
// 2) node scripts/build.js remote                    （新：首个参数作为变体，默认构建为 userscript）
let buildType = 'dev'
let variant = 'default'
if (args.length === 0) {
  buildType = 'dev'
} else if (args.length === 1) {
  if (Object.prototype.hasOwnProperty.call(configs, args[0])) {
    // 传入的是已知的构建类型
    buildType = args[0]
  } else {
    // 传入的是变体（首个参数），默认构建为 userscript
    buildType = 'build:userscript'
    variant = args[0]
  }
} else {
  // 两个及以上参数，保持原有语义：第一个为构建类型，第二个为变体
  buildType = args[0]
  variant = args[1] || 'default'
}

const config = configs[buildType]
if (!config) {
  console.error(`未知的构建类型: ${buildType}`)
  console.error(`可用的构建类型: ${Object.keys(configs).join(', ')}`)
  process.exit(1)
}

// 设置环境变量
Object.assign(process.env, config)
// 把可选的构建变体注入环境变量，供 vite 配置读取
process.env.USERSCRIPT_VARIANT = variant

// Note: build-time generation of defaultEmojiGroups.ts has been removed.

// 打印配置信息
console.log(`🚀 开始构建 (${buildType})`)
console.log(`📋 配置:`)
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`)
})
console.log('')
if (variant && variant !== 'default') {
  console.log(`🔀 构建变体: ${variant}`)
}

// 执行 vite build
const isUserscript = buildType.startsWith('build:userscript')
const viteCommand =
  buildType === 'dev'
    ? 'vite'
    : `vite build${isUserscript ? ' --config vite.config.userscript.ts' : ''}`
// Variant flag functionality removed - development variant no longer supported
const publicDir = path.resolve(process.cwd(), 'public')
const distDir = path.resolve(process.cwd(), 'dist')

const child = spawn('npx', viteCommand.split(' '), {
  stdio: 'inherit',
  env: process.env,
  shell: true
})

child.on('exit', code => {
  if (code === 0 && buildType !== 'dev') {
    // For userscript builds, run post-processing instead of clean-empty-chunks
    if (isUserscript) {
      console.log('🔧 Post-processing userscript...')
      const postProcessChild = spawn('node', ['./scripts/post-process-userscript.js', buildType], {
        stdio: 'inherit',
        shell: true
      })

      postProcessChild.on('exit', postCode => {
        if (postCode === 0) {
          console.log('✅ Userscript build completed!')
        } else {
          console.error('❌ Userscript post-processing failed')
        }
        process.exit(postCode)
      })
    }
  } else {
    process.exit(code)
  }
})
