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

// Note: build-time generation of defaultEmojiGroups.ts has been removed.

// Also, ensure a runtime JSON is available in public/assets for the loader
try {
  const configPath = path.resolve(process.cwd(), 'src/config/default.json')
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const configData = JSON.parse(configContent)

  if (configData) {
    // Create assets/json directory
    const jsonDir = path.resolve(process.cwd(), 'scripts', 'cfworker', 'public', 'assets', 'json')
    fs.mkdirSync(jsonDir, { recursive: true })

    // Write settings.json
    if (configData.settings) {
      const settingsOut = path.resolve(jsonDir, 'settings.json')
      const settingsJsonString = JSON.stringify(configData.settings)
      fs.writeFileSync(settingsOut, settingsJsonString, 'utf-8')
      console.log(`ℹ️ Wrote runtime settings JSON to ${settingsOut}`)
    }

    // Prepare group index for manifest
    const groupIndex = []

    // Write individual emoji group JSON files
    if (configData.groups && Array.isArray(configData.groups)) {
      for (const group of configData.groups) {
        const groupOut = path.resolve(jsonDir, `${group.id}.json`)
        const groupJsonString = JSON.stringify({
          emojis: group.emojis,
          icon: group.icon,
          id: group.id,
          name: group.name,
          order: group.order
        })
        fs.writeFileSync(groupOut, groupJsonString, 'utf-8')

        // Add to group index for manifest
        groupIndex.push({
          id: group.id,
          name: group.name,
          order: group.order || 0,
          icon: group.icon || '',
          emojiCount: Array.isArray(group.emojis) ? group.emojis.length : 0
        })
      }
      console.log(`ℹ️ Wrote ${configData.groups.length} emoji group JSON files to ${jsonDir}`)
    }

    const manifestOut = path.resolve(jsonDir, 'manifest.json')
    const manifestJsonString = JSON.stringify(
      {
        groups: groupIndex,
        version: configData.version,
        exportDate: configData.exportDate
      },
      null,
      2
    )
    fs.writeFileSync(manifestOut, manifestJsonString, 'utf-8')

    console.log(`ℹ️ Wrote runtime manifest JSON to ${manifestOut}`)
  }
} catch (e) {
  console.warn('⚠️ Failed to write runtime JSON files:', e)
}

// 打印配置信息
console.log(`🚀 开始构建 (${buildType})`)
console.log(`📋 配置:`)
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`)
})

// 检查命令行参数是否包含 --no-eslint
const skipEslint = args.includes('--no-eslint')

// 执行 vite（开发或构建）
const isUserscript = buildType.startsWith('build:userscript')

// For userscript builds, we need to build two separate scripts
if (isUserscript) {
  // Build core script first
  console.log('📦 Building core emoji picker script...')
  const coreEnv = {
    ...process.env,
    SCRIPT_TARGET: 'core',
    SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT
  }
  const viteArgs = ['build', '--config', 'vite.config.userscript.ts']

  const coreChild = spawn(PKG_MANAGER, ['exec', 'vite', ...viteArgs], {
    stdio: 'inherit',
    env: coreEnv,
    shell: false
  })

  coreChild.on('exit', coreCode => {
    if (coreCode !== 0) {
      console.error('❌ Core script build failed')
      process.exit(coreCode)
    }

    // Build manager script
    console.log('📦 Building emoji manager script...')
    const managerEnv = {
      ...process.env,
      SCRIPT_TARGET: 'manager',
      SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT
    }

    const managerChild = spawn(PKG_MANAGER, ['exec', 'vite', ...viteArgs], {
      stdio: 'inherit',
      env: managerEnv,
      shell: false
    })

    managerChild.on('exit', managerCode => {
      if (managerCode !== 0) {
        console.error('❌ Manager script build failed')
        process.exit(managerCode)
      }

      // Post-process both scripts
      console.log('🔧 Post-processing userscripts...')
      const postProcessEnv = {
        ...process.env,
        SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT
      }
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
    })
  })
} else {
  // 构建时传递给 `vite` 的参数数组。dev 模式不传额外参数（等价于 `pnpm exec vite`）。
  const viteArgs = buildType === 'dev' ? [] : ['build']
  // Variant flag functionality removed - development variant no longer supported
  const publicDir = path.resolve(process.cwd(), 'public')
  const distDir = path.resolve(process.cwd(), 'dist')

  const child = spawn(PKG_MANAGER, ['exec', 'vite', ...viteArgs], {
    stdio: 'inherit',
    env: { ...process.env, SKIP_ESLINT: skipEslint ? 'true' : process.env.SKIP_ESLINT },
    shell: false
  })

  child.on('exit', code => {
    if (code === 0 && buildType !== 'dev') {
      // For non-userscript builds, just exit
      console.log('✅ Build completed!')
    }
    process.exit(code)
  })
}
