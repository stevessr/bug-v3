#!/usr/bin/env node
/**
 * 打包 Firefox XPI 文件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ZipArchive } from 'archiver'
import { createFirefoxManifest } from './firefox-manifest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createXPI({
  distPath = path.resolve(__dirname, '../dist'),
  outputPath = path.resolve(__dirname, '../bug-v3.xpi')
} = {}) {
  console.log('📦 创建 Firefox XPI 文件...')

  if (!fs.existsSync(distPath)) {
    console.error('❌ dist 目录不存在，请先运行构建')
    process.exit(1)
  }

  // 创建 ZIP 文件（XPI 本质上就是 ZIP）
  const output = fs.createWriteStream(outputPath)
  const archive = new ZipArchive({
    zlib: { level: 9 } // 最高压缩级别
  })

  const completed = new Promise((resolve, reject) => {
    output.on('error', reject)
    archive.on('error', reject)
    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`✅ XPI 文件已创建：${outputPath}`)
      console.log(`   文件大小：${sizeInMB} MB`)
      resolve(outputPath)
    })
  })
  archive.pipe(output)

  // Firefox 变体 manifest：剔除 Chromium-only 权限（sidePanel 等），
  // 打包时应用 sidebar_action / event page 归一化。
  const manifestSource = path.join(distPath, 'manifest.json')
  if (fs.existsSync(manifestSource)) {
    const sourceManifest = JSON.parse(fs.readFileSync(manifestSource, 'utf8'))
    archive.append(JSON.stringify(createFirefoxManifest(sourceManifest), null, 2), {
      name: 'manifest.json'
    })
    console.log('✅ 已应用 Firefox manifest 归一化（剔除 Chromium-only 权限）')
  }
  // Never rewrite dist/manifest.json: loading dist in Chromium after pack:xpi
  // must still use its service worker and Chromium-only keys/permissions.
  archive.glob('**/*', { cwd: distPath, ignore: ['manifest.json'], dot: true })
  archive.finalize().catch(error => archive.emit('error', error))
  return completed
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  await createXPI()
}

export { createXPI }
