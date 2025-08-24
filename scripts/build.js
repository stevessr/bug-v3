#!/usr/bin/env node
// 跨平台构建脚本
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// 解析命令行参数
const args = process.argv.slice(2)
const buildType = args[0] || 'dev'

// 定义环境变量配置
const configs = {
  dev: {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'development'
  },
  'dev:variant': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'development'
  },
  build: {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production'
  },
  'build:variant': {
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
  }
}

const config = configs[buildType]
if (!config) {
  console.error(`未知的构建类型: ${buildType}`)
  console.error(`可用的构建类型: ${Object.keys(configs).join(', ')}`)
  process.exit(1)
}

// 设置环境变量
Object.assign(process.env, config)

// 打印配置信息
console.log(`🚀 开始构建 (${buildType})`)
console.log(`📋 配置:`)
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`)
})
console.log('')

// 执行 vite build
const isUserscript = buildType.startsWith('build:userscript')
const viteCommand =
  buildType === 'dev'
    ? 'vite'
    : `vite build${isUserscript ? ' --config vite.config.userscript.ts' : ''}`
// Variant flag: when true, we'll write manifest.development.json into dist/manifest.json after build
const isVariant = buildType.endsWith(':variant') || buildType === 'dev:variant'
const publicDir = path.resolve(process.cwd(), 'public')
const devManifest = path.join(publicDir, 'manifest.development.json')
const distDir = path.resolve(process.cwd(), 'dist')

// Safe restore helper: remove a partially-written dist/manifest.json if present.
function restoreManifest() {
  try {
    const target = path.join(distDir, 'manifest.json')
    if (fs.existsSync(target)) {
      fs.unlinkSync(target)
      console.log('🔁 Removed partially written', target)
    } else {
      console.log('🔁 No dist manifest to restore')
    }
  } catch (e) {
    console.warn('🔁 restoreManifest error:', e)
  }
}

const child = spawn('npx', viteCommand.split(' '), {
  stdio: 'inherit',
  env: process.env,
  shell: true
})

child.on('exit', code => {
  if (code === 0 && buildType !== 'dev') {
    console.log('Running post build')
    const fixResult = spawnSync('node', ['./scripts/fix-content-build.cjs'], {
      stdio: 'inherit',
      shell: true
    })
    if (fixResult.error) {
      console.error('❌ fix-content-build failed to start:', fixResult.error)
      process.exit(1)
    }
    if (fixResult.status !== 0) {
      console.error('❌ fix-content-build exited with code', fixResult.status)
      process.exit(fixResult.status)
    }
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
    } else {
      // Original Chrome extension build flow
      console.log('🧹 清理空文件...')
      const cleanChild = spawn('node', ['./scripts/clean-empty-chunks.mjs'], {
        stdio: 'inherit',
        shell: true
      })

      cleanChild.on('exit', cleanCode => {
        if (cleanCode === 0) {
          console.log('✅ 构建完成！')
          if (isVariant) {
            try {
              if (fs.existsSync(devManifest) && fs.existsSync(distDir)) {
                const target = path.join(distDir, 'manifest.json')
                fs.copyFileSync(devManifest, target)
                console.log('🔀 Wrote development manifest to', target)
              } else if (!fs.existsSync(devManifest)) {
                console.warn('manifest.development.json not found; skipping writing to dist')
              }
            } catch (e) {
              console.error('Failed to write dev manifest to dist:', e)
            }
          }
        } else {
          console.error('❌ 清理过程出错')
        }
        process.exit(cleanCode)
      })
    }
  } else {
    if (isVariant) {
      restoreManifest()
    }
    process.exit(code)
  }
})
