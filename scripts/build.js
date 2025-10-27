#!/usr/bin/env node
// 跨平台构建脚本
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// 定义环境变量配置
const configs = {
  dev: {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'development'
  },

  build: {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'production'
  },

  'build:prod': {
    ENABLE_LOGGING: 'false',
    NODE_ENV: 'production'
  },
  'build:minimal': {
    ENABLE_LOGGING: 'false',
    NODE_ENV: 'production'
  },
  'build:userscript': {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'false'
  },
  'build:userscript:min': {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'true'
  },
  // 新增：仅编译、不混淆（调试用）
  'build:debug': {
    ENABLE_LOGGING: 'true',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'false'
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
// 固定 userscript 变体为 remote，移除变体选择和平台支持
if (buildType.startsWith('build:userscript')) {
  process.env.USERSCRIPT_VARIANT = 'remote'
}

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
console.log('')
// Platform and variant selection removed; builds are fixed to remote defaults

// 检查命令行参数是否包含 --no-eslint
const skipEslint = args.includes('--no-eslint')

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
  env: { ...process.env, SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT },
  shell: false
})

child.on('exit', code => {
  if (code === 0 && buildType !== 'dev') {
    // For userscript builds, run post-processing instead of clean-empty-chunks
    if (isUserscript) {
      console.log('🔧 Post-processing userscript...')
      const postProcessEnv = { ...process.env, SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT }
      const postProcessChild = spawn('node', ['./scripts/post-process-userscript.js', buildType], {
        stdio: 'inherit',
        env: postProcessEnv,
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
    }
  } else {
    process.exit(code)
  }
})
