#!/usr/bin/env node
/**
 * 生成或加载固定的扩展签名密钥
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const KEY_PATH = path.join(__dirname, '../extension-key.pem')

function generateOrLoadKey() {
  // 如果密钥文件已存在，直接返回
  if (fs.existsSync(KEY_PATH)) {
    console.log('✅ 使用现有私钥：', KEY_PATH)
    return KEY_PATH
  }

  // 生成新的私钥
  console.log('🔑 生成新的扩展签名密钥...')
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    }
  })

  // 保存私钥（只有所有者可读写）
  fs.writeFileSync(KEY_PATH, privateKey, { mode: 0o600 })

  // 保存公钥（参考用）
  const publicKeyPath = path.join(__dirname, '../extension-public.pem')
  const { publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    }
  })
  fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 })

  console.log('✅ 密钥已生成：')
  console.log('   私钥：', KEY_PATH)
  console.log('   公钥：', publicKeyPath)
  console.log('\n⚠️  重要提示：')
  console.log('   - 请妥善保管私钥文件')
  console.log('   - 丢失私钥将无法发布更新版本的扩展')
  console.log('   - 建议将私钥备份到安全的位置')

  return KEY_PATH
}

// 运行主函数
generateOrLoadKey()

export { generateOrLoadKey, KEY_PATH }
