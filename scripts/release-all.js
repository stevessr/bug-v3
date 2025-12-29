#!/usr/bin/env node
/**
 * 一键发布脚本
 * 构建、打包、更新版本信息并部署到 Cloudflare Pages
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`)
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    })
    console.log(`✅ ${description} 完成`)
  } catch (error) {
    console.error(`❌ ${description} 失败:`, error.message)
    process.exit(1)
  }
}

function checkFiles() {
  const requiredFiles = ['../dist', '../public/manifest.json']

  for (const file of requiredFiles) {
    const filePath = path.resolve(__dirname, file)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 必需文件不存在：${filePath}`)
      process.exit(1)
    }
  }
  console.log('✅ 所有必要文件检查通过')
}

function getDeploymentInfo() {
  const packagePath = path.resolve(__dirname, '../package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  const version = packageJson.version

  console.log(`\n📋 发布信息:`)
  console.log(`   版本：${version}`)

  return version
}

async function main() {
  console.log('🚀 开始一键发布流程...\n')

  // 检查必要文件
  console.log('🔍 检查项目文件...')
  checkFiles()

  // 获取发布信息
  const version = getDeploymentInfo()

  // 执行发布步骤
  runCommand('npm run build:prod', '构建生产版本')
  runCommand('npm run pack:all', '打包扩展文件')
  runCommand('npm run update:version', '更新版本信息')
  runCommand('npm run update:data', '部署到 Cloudflare Pages')

  console.log('\n🎉 发布完成！')
  console.log('\n📋 后续操作：')
  console.log('1. 在 Chrome 中加载扩展测试更新')
  console.log('2. 在 Firefox 中测试扩展功能')
  console.log('3. 验证自动更新是否正常工作')
  console.log('\n🔗 相关链接：')
  console.log(`   项目主页：https://github.com/stevessr/bug-v3`)
  console.log(`   Pages 部署：https://s.pwsh.us.kg`)
  console.log(`   更新检查：https://s.pwsh.us.kg/updates.xml`)
}

// 运行主函数
main().catch(console.error)
