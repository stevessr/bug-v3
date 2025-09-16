#!/usr/bin/env node
// 跨平台构建脚本
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

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
let platform = process.env.USERSCRIPT_PLATFORM || 'original' // pc, mobile, original

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
// For userscript builds, default to 'embedded' unless caller explicitly set a variant.
if (
  buildType.startsWith('build:userscript') &&
  process.env.USERSCRIPT_VARIANT === undefined &&
  args.length <= 1
) {
  // If user didn't pass an explicit variant, embed defaults into the userscript bundle.
  process.env.USERSCRIPT_VARIANT = 'embedded'
} else {
  process.env.USERSCRIPT_VARIANT = variant
}

// Set platform variant for userscript builds
process.env.USERSCRIPT_PLATFORM = platform

// Note: build-time generation of defaultEmojiGroups.ts has been removed.

// Also, ensure a runtime JSON is available in public/assets for the loader
try {
  const configPath = path.resolve(process.cwd(), 'src/config/default.json')
  const jsonOut = path.resolve(process.cwd(), 'public', 'assets', 'defaultEmojiGroups.json')
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const configData = JSON.parse(configContent)
  if (configData && Array.isArray(configData.groups)) {
    try {
      fs.mkdirSync(path.dirname(jsonOut), { recursive: true })
      // Write compact (minified) JSON to reduce file size. Do NOT produce a .gz file here.
      const jsonString = JSON.stringify({ groups: configData.groups })
      fs.writeFileSync(jsonOut, jsonString, 'utf-8')
      console.log(`ℹ️ Wrote runtime defaultEmojiGroups JSON to ${jsonOut}`)
    } catch (e) {
      console.warn('⚠️ Failed to write runtime defaultEmojiGroups JSON:', e)
    }
  }
} catch (e) {
  // ignore
}

// 打印配置信息
console.log(`🚀 开始构建 (${buildType})`)
console.log(`📋 配置:`)
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`)
})
console.log(`   USERSCRIPT_VARIANT: ${process.env.USERSCRIPT_VARIANT}`)
console.log(`   USERSCRIPT_PLATFORM: ${process.env.USERSCRIPT_PLATFORM}`)
console.log('')
if (variant && variant !== 'default') {
  console.log(`🔀 构建变体: ${variant}`)
}

// 执行 vite（开发或构建）
const isUserscript = buildType.startsWith('build:userscript')
// 构建时传递给 `vite` 的参数数组。dev 模式不传额外参数（等价于 `pnpm exec vite`）。
const viteArgs =
  buildType === 'dev'
    ? []
    : ['build', ...(isUserscript ? ['--config', 'vite.config.userscript.ts'] : [])]
// Variant flag functionality removed - development variant no longer supported
const publicDir = path.resolve(process.cwd(), 'public')
const distDir = path.resolve(process.cwd(), 'dist')

const child = spawn('pnpm', ['exec', 'vite', ...viteArgs], {
  stdio: 'inherit',
  env: process.env,
  shell: false
})

child.on('exit', code => {
  if (code === 0 && buildType !== 'dev') {
    // For userscript builds, run post-processing instead of clean-empty-chunks
    if (isUserscript) {
      console.log('🔧 Post-processing userscript...')
      const postProcessChild = spawn('node', ['./scripts/post-process-userscript.js', buildType], {
        stdio: 'inherit',
        shell: false
      })

      postProcessChild.on('exit', postCode => {
        if (postCode === 0) {
          console.log('✅ Userscript build completed!')
        } else {
          console.error('❌ Userscript post-processing failed')
        }
        process.exit(postCode)
      })
    } else {
      // Original Chrome extension build flow
      console.log('🧹 清理空文件...')
      const cleanChild = spawn('node', ['./scripts/clean-empty-chunks.mjs'], {
        stdio: 'inherit',
        shell: false
      })

      cleanChild.on('exit', cleanCode => {
        if (cleanCode === 0) {
          // Vite produced the content.js chunk according to rollupOptions.manualChunks
          // and output file names; no separate bundling step is required.
          console.log('✅ 构建完成！')
        } else {
          console.error('❌ 清理过程出错')
        }
        process.exit(cleanCode)
      })
    }
  } else {
    process.exit(code)
  }
})
