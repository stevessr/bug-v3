#!/usr/bin/env node
/**
 * 打包 Firefox XPI 文件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { ZipArchive } from 'archiver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createXPI() {
  const distPath = path.resolve(__dirname, '../dist')
  const outputPath = path.resolve(__dirname, '../bug-v3.xpi')

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

  output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2)
    console.log(`✅ XPI 文件已创建：${outputPath}`)
    console.log(`   文件大小：${sizeInMB} MB`)
  })

  archive.on('error', err => {
    throw err
  })

  // 将 dist 目录内容添加到 ZIP
  archive.directory(distPath, false)
  archive.finalize()
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  createXPI()
}

export { createXPI }
