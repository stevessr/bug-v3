#!/usr/bin/env node
// Standalone script to generate JSON assets from config files.

import fs from 'fs'
import path from 'path'

console.log('🚀 Starting JSON generation...')

// Generate defaultEmojiGroups JSON
try {
  const configPath = path.resolve(process.cwd(), 'src/config/default.json')
  const jsonOut = path.resolve(
    process.cwd(),
    'public',
    'assets',
    'defaultEmojiGroups.json'
  )
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const configData = JSON.parse(configContent)
  if (configData && Array.isArray(configData.groups)) {
    try {
      fs.mkdirSync(path.dirname(jsonOut), { recursive: true })

      // Write plain JSON for runtime loader
      const jsonString = JSON.stringify({ groups: configData.groups }, null, 2)
      fs.writeFileSync(jsonOut, jsonString, 'utf-8')
      console.log(`✅ Generated defaultEmojiGroups JSON: ${jsonOut}`)
    } catch (e) {
      console.error('❌ Failed to generate defaultEmojiGroups:', e)
      process.exit(1)
    }
  }
} catch (e) {
  console.error('❌ Failed to read source config:', e)
  process.exit(1)
}

// Generate bilibiliEmojiIndex JSON
try {
  const bilibiliConfigPath = path.resolve(
    process.cwd(),
    'src/config/bilibili_emoji_index.json'
  )
  const bilibiliJsonOut = path.resolve(
    process.cwd(),
    'public',
    'assets',
    'bilibiliEmojiIndex.json'
  )
  const bilibiliConfigContent = fs.readFileSync(bilibiliConfigPath, 'utf-8')
  const bilibiliConfigData = JSON.parse(bilibiliConfigContent)

  try {
    fs.mkdirSync(path.dirname(bilibiliJsonOut), { recursive: true })

    // Write plain JSON for runtime loader
    const bilibiliJsonString = JSON.stringify(bilibiliConfigData, null, 2)
    fs.writeFileSync(bilibiliJsonOut, bilibiliJsonString, 'utf-8')
    console.log(`✅ Generated bilibiliEmojiIndex JSON: ${bilibiliJsonOut}`)
  } catch (e) {
    console.error('❌ Failed to generate bilibiliEmojiIndex:', e)
    process.exit(1)
  }
} catch (e) {
  console.error('❌ Failed to read bilibili emoji config:', e)
  process.exit(1)
}

console.log('✅ JSON generation complete!')
