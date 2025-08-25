#!/usr/bin/env node
// 跨平台构建脚本
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// 解析命令行参数
const args = process.argv.slice(2)
const buildType = args[0] || 'dev'

// Function to restore manifest if needed
const restoreManifest = () => {
  console.log('Restoring manifest...')
  // Add manifest restoration logic if needed
}

// 定义环境变量配置
const configs = {
  dev: {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'development',
  },
  'dev:variant': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'development',
  },
  build: {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production',
  },
  'build:variant': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production',
  },
  'build:prod': {
    ENABLE_LOGGING: 'false',
    ENABLE_INDEXEDDB: 'true',
    NODE_ENV: 'production',
  },
  'build:no-indexeddb': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production',
  },
  'build:minimal': {
    ENABLE_LOGGING: 'false',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production',
  },
  'build:userscript': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'false',
  },
  'build:userscript:min': {
    ENABLE_LOGGING: 'true',
    ENABLE_INDEXEDDB: 'false',
    NODE_ENV: 'production',
    BUILD_MINIFIED: 'true',
  },
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

const child = spawn('npx', viteCommand.split(' '), {
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

child.on('exit', (code) => {
  if (code === 0 && buildType !== 'dev') {
    // For userscript builds, run post-processing instead of clean-empty-chunks
    if (isUserscript) {
      console.log('🔧 Post-processing userscript...')
      const postProcessChild = spawn('node', ['./scripts/post-process-userscript.js', buildType], {
        stdio: 'inherit',
        shell: true,
      })

      postProcessChild.on('exit', (postCode) => {
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
        shell: true,
      })

      cleanChild.on('exit', (cleanCode) => {
        if (cleanCode === 0) {
          // Move HTML files from dist/html/ to dist/
          try {
            const htmlDir = path.join(distDir, 'html')
            if (fs.existsSync(htmlDir)) {
              const htmlFiles = fs.readdirSync(htmlDir)
              for (const file of htmlFiles) {
                if (file.endsWith('.html')) {
                  const source = path.join(htmlDir, file)
                  const target = path.join(distDir, file)
                  fs.copyFileSync(source, target)
                  console.log(`📄 Moved ${file} to dist root`)
                }
              }
              // Remove the html directory
              fs.rmSync(htmlDir, { recursive: true, force: true })
            }
          } catch (e) {
            console.error('Failed to move HTML files:', e)
          }

          // Inject script tags into HTML files
          console.log('🔧 Injecting script tags...')
          const injectChild = spawn('node', ['./scripts/inject-scripts.js'], {
            stdio: 'inherit',
            shell: true,
          })

          injectChild.on('exit', (injectCode) => {
            if (injectCode !== 0) {
              console.warn('Script injection completed with warnings')
            }
            // attempt to locate background bundle in dist and copy to dist/background.js
            try {
              const assetsDir = path.join(distDir, 'assets')
              if (fs.existsSync(assetsDir)) {
                const files = fs.readdirSync(assetsDir)
                const bg = files.find((f) => f.startsWith('background') && f.endsWith('.js'))
                if (bg) {
                  const src = path.join(assetsDir, bg)
                  const dest = path.join(distDir, 'background.js')
                  fs.copyFileSync(src, dest)
                  console.log('🔀 Copied background bundle to dist/background.js')
                }
              }
            } catch (e) {
              console.warn('Could not copy background bundle:', e)
            }

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
          })
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
