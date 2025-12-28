#!/usr/bin/env node
/**
 * Prepare JSON Assets Script
 *
 * 将表情配置 JSON 处理为 CloudFlare Worker 所需的 JSON 资源
 * 用法：node scripts/prepare-json-assets.js <json_path> <target_path>
 *
 * 参数：
 *   json_path: 输入的 JSON 配置文件路径（默认：src/config/default.json）
 *   target_path: 输出目录路径（默认：scripts/cfworker/public/assets/json）
 *
 * 生成的文件：
 * - settings.json: 应用设置
 * - [groupId].json: 每个表情分组的独立 JSON 文件
 * - manifest.json: 分组索引清单
 */

import fs from 'fs'
import path from 'path'

// 解析命令行参数
const args = process.argv.slice(2)
const defaultJsonPath = 'scripts/cfworker/public/assets/defaultEmojiGroups.json'
const defaultTargetPath = 'scripts/cfworker/public/assets/json'

const jsonPath = args[0] || defaultJsonPath
const targetPath = args[1] || defaultTargetPath

console.log('📦 Preparing JSON assets for CloudFlare Worker...\n')

try {
  const configPath = path.resolve(process.cwd(), jsonPath)

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Error: Input file not found: ${configPath}`)
    console.error('\nUsage: node scripts/prepare-json-assets.js <json_path> <target_path>')
    console.error(`  json_path: Input JSON config file (default: ${defaultJsonPath})`)
    console.error(`  target_path: Output directory (default: ${defaultTargetPath})`)
    process.exit(1)
  }

  console.log(`📖 Reading config from: ${configPath}`)
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const configData = JSON.parse(configContent)

  // Create output directory
  const jsonDir = path.resolve(process.cwd(), targetPath)
  fs.mkdirSync(jsonDir, { recursive: true })
  console.log(`📁 Output directory: ${jsonDir}\n`)

  // Write settings.json
  if (configData.settings) {
    const settingsOut = path.resolve(jsonDir, 'settings.json')
    const settingsJsonString = JSON.stringify(configData.settings)
    fs.writeFileSync(settingsOut, settingsJsonString, 'utf-8')
    console.log(`✅ Wrote settings.json (${(settingsJsonString.length / 1024).toFixed(2)} KB)`)
  }

  // Prepare group index for manifest
  const groupIndex = []
  let totalEmojis = 0

  // Write individual emoji group JSON files
  if (configData.groups && Array.isArray(configData.groups)) {
    for (const group of configData.groups) {
      const groupOut = path.resolve(jsonDir, `${group.id}.json`)
      const groupData = {
        emojis: group.emojis,
        icon: group.icon,
        id: group.id,
        name: group.name,
        order: group.order
      }
      const groupJsonString = JSON.stringify(groupData)
      fs.writeFileSync(groupOut, groupJsonString, 'utf-8')

      const emojiCount = Array.isArray(group.emojis) ? group.emojis.length : 0
      totalEmojis += emojiCount

      // Add to group index for manifest
      groupIndex.push({
        id: group.id,
        name: group.name,
        order: group.order || 0,
        icon: group.icon || '',
        emojiCount
      })
    }
    console.log(`✅ Wrote ${configData.groups.length} emoji group JSON files`)
  }

  // Write manifest.json
  const manifestOut = path.resolve(jsonDir, 'manifest.json')
  const manifestData = {
    groups: groupIndex,
    version: configData.version,
    exportDate: configData.exportDate || new Date().toISOString()
  }
  const manifestJsonString = JSON.stringify(manifestData, null, 2)
  fs.writeFileSync(manifestOut, manifestJsonString, 'utf-8')
  console.log(`✅ Wrote manifest.json (${groupIndex.length} groups, ${totalEmojis} total emojis)`)

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Output directory: ${jsonDir}`)
  console.log(`   Files generated: ${groupIndex.length + 2}`) // groups + settings + manifest
  console.log(`   Total emoji groups: ${groupIndex.length}`)
  console.log(`   Total emojis: ${totalEmojis}`)
  console.log('\n✨ JSON assets prepared successfully!')
} catch (e) {
  console.error('\n❌ Failed to prepare JSON assets:')
  console.error(e)
  process.exit(1)
}
