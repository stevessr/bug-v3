#!/usr/bin/env node
/**
 * 自动更新扩展版本信息脚本
 * 用于在发布新版本时自动更新更新服务器上的 XML 和 JSON 文件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置
const CONFIG = {
  extensionId: 'lcjnmefemojopjdnkjhacphegcaemcja', // Chrome 扩展 ID
  baseUrl: 'https://s.pwsh.us.kg',
  updateDir: path.join(__dirname, 'cfworker/public'),
  distDir: path.join(__dirname, '../dist'),
  crxFile: path.join(__dirname, '../bug-v3.crx'),
  xpiFile: path.join(__dirname, '../bug-v3.xpi'),
  zipFile: path.join(__dirname, '../bug-v3.zip')
}

// 从 package.json 读取版本
function getCurrentVersion() {
  const packagePath = path.join(__dirname, '../package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  return packageJson.version
}

// 计算文件的 SHA256 哈希
function calculateSHA256(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`文件不存在：${filePath}`)
    return null
  }

  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

// 生成 Chrome 更新的 XML 文件
function generateChromeXML(version, crxUrl) {
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${CONFIG.extensionId}'>
    <updatecheck codebase='${crxUrl}' version='${version}' />
  </app>
</gupdate>`
}

// 生成 Firefox 更新的 JSON 文件
function generateFirefoxJSON(version, xpiUrl, xpiHash) {
  return JSON.stringify(
    {
      addons: {
        [`${CONFIG.extensionId}@pwsh.us.kg`]: {
          updates: [
            {
              version: version,
              update_link: xpiUrl,
              update_hash: `sha256:${xpiHash}`
            }
          ]
        }
      }
    },
    null,
    2
  )
}

// 更新 Chrome XML 文件
function updateChromeXML(version) {
  const crxUrl = `${CONFIG.baseUrl}/updates/extension.crx`
  const xmlContent = generateChromeXML(version, crxUrl)
  const xmlPath = path.join(CONFIG.updateDir, 'updates.xml')

  fs.writeFileSync(xmlPath, xmlContent, 'utf-8')
  console.log(`✅ Chrome 更新 XML 已更新：${xmlPath}`)
  console.log(`   版本：${version}`)
  console.log(`   下载链接：${crxUrl}`)
}

// 更新 Firefox JSON 文件
function updateFirefoxJSON(version) {
  const xpiUrl = `${CONFIG.baseUrl}/updates/extension.xpi`
  const xpiHash = calculateSHA256(CONFIG.xpiFile) || calculateSHA256(CONFIG.zipFile)

  if (!xpiHash) {
    console.error('❌ 无法计算 XPI 文件哈希，跳过 Firefox 更新')
    return
  }

  const jsonContent = generateFirefoxJSON(version, xpiUrl, xpiHash)
  const jsonPath = path.join(CONFIG.updateDir, 'updates.json')

  fs.writeFileSync(jsonPath, jsonContent, 'utf-8')
  console.log(`✅ Firefox 更新 JSON 已更新：${jsonPath}`)
  console.log(`   版本：${version}`)
  console.log(`   下载链接：${xpiUrl}`)
  console.log(`   SHA256: ${xpiHash}`)
}

// 复制扩展文件到更新目录
function copyExtensionFiles() {
  const updateFilesDir = path.join(CONFIG.updateDir, 'updates')
  fs.mkdirSync(updateFilesDir, { recursive: true })

  // 复制 CRX 文件
  if (fs.existsSync(CONFIG.crxFile)) {
    const targetCrx = path.join(updateFilesDir, 'extension.crx')
    fs.copyFileSync(CONFIG.crxFile, targetCrx)
    console.log(`✅ CRX 文件已复制到：${targetCrx}`)
  }

  // 复制 XPI 文件（如果存在）
  if (fs.existsSync(CONFIG.xpiFile)) {
    const targetXpi = path.join(updateFilesDir, 'extension.xpi')
    fs.copyFileSync(CONFIG.xpiFile, targetXpi)
    console.log(`✅ XPI 文件已复制到：${targetXpi}`)
  } else if (fs.existsSync(CONFIG.zipFile)) {
    // 如果没有 XPI 文件，使用 ZIP 文件作为替代
    const targetXpi = path.join(updateFilesDir, 'extension.xpi')
    fs.copyFileSync(CONFIG.zipFile, targetXpi)
    console.log(`✅ ZIP 文件已复制为 XPI: ${targetXpi}`)
  }
}

// 生成部署脚本
function generateDeployScript(version) {
  const deployScript = `#!/bin/bash
# 自动部署脚本 - 版本 ${version}

echo "🚀 开始部署扩展更新..."

# 进入 CF Worker 目录
cd "$(dirname "$0")/cfworker"

# 部署到 Cloudflare Pages
echo "📦 部署到 Cloudflare Pages..."
wrangler pages deploy

echo "✅ 部署完成！"
echo "📍 更新 URL:"
echo "   Chrome: https://s.pwsh.us.kg/updates.xml"
echo "   Firefox: https://s.pwsh.us.kg/updates.json"
echo "   下载：https://s.pwsh.us.kg/updates/extension.crx"
`

  const scriptPath = path.join(__dirname, 'deploy-update.sh')
  fs.writeFileSync(scriptPath, deployScript, 'utf-8')
  fs.chmodSync(scriptPath, '755')
  console.log(`✅ 部署脚本已生成：${scriptPath}`)
}

// 主函数
function main() {
  console.log('🔄 开始更新扩展版本信息...\n')

  const version = getCurrentVersion()
  console.log(`📋 当前版本：${version}\n`)

  // 复制扩展文件
  console.log('📁 复制扩展文件...')
  copyExtensionFiles()
  console.log('')

  // 更新 Chrome XML
  console.log('🔧 更新 Chrome 更新文件...')
  updateChromeXML(version)
  console.log('')

  // 更新 Firefox JSON
  console.log('🔧 更新 Firefox 更新文件...')
  updateFirefoxJSON(version)
  console.log('')

  // 生成部署脚本
  console.log('📜 生成部署脚本...')
  generateDeployScript(version)
  console.log('')

  console.log('✨ 更新完成！')
  console.log('\n📋 下一步操作：')
  console.log('1. 运行 ./scripts/deploy-update.sh 部署到 Cloudflare Pages')
  console.log('2. 确保扩展文件已上传到更新服务器')
  console.log('3. 测试自动更新功能')
}

// 运行主函数
main()
