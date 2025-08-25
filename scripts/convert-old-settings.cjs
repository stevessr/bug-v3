/*
  脚本：将旧格式（public/static/config/default.json）转换为新的持久化 payload
  输出：打印 JSON 到 stdout，并写入 public/static/config/converted_payload.json

  运行（在仓库根目录）:
    node scripts/convert-old-settings.cjs
*/
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const src = path.resolve(__dirname, '..', 'public', 'static', 'config', 'default.json')
const out = path.resolve(__dirname, '..', 'public', 'static', 'config', 'converted_payload.json')

// 生成 UUID v4
function generateUUID() {
  return crypto.randomUUID()
}

// 为表情组生成UUID并建立ID到UUID的映射
function processGroups(groups) {
  const idToUuidMap = {}
  const processedGroups = []
  const ungrouped = []

  groups.forEach((group) => {
    const uuid = generateUUID()
    idToUuidMap[group.id] = uuid

    // 处理组内的表情，也为每个表情生成UUID
    const processedEmojis = (group.emojis || []).map((emoji) => {
      const processedEmoji = {
        ...emoji,
        // 保留原始名称，映射到 displayName
        originalName: typeof emoji.name !== 'undefined' ? emoji.name : undefined,
        displayName: typeof emoji.name !== 'undefined' ? emoji.name : emoji.displayName,
        UUID: generateUUID(),
        groupUUID: uuid, // 更新为新的UUID
        groupId: uuid, // 保持兼容性，但使用UUID
      }

      // 映射 url 到 realUrl 和 displayUrl
      if (emoji.url) {
        processedEmoji.realUrl = emoji.url
        processedEmoji.displayUrl = emoji.url
      }

      return processedEmoji
    })

    // 特殊 id 映射到固定的中文显示名
    let mappedDisplayName
    if (group.id === 'ungrouped') mappedDisplayName = '未分组'
    else if (group.id === 'favorites') mappedDisplayName = '常用表情'
    else mappedDisplayName = typeof group.name !== 'undefined' ? group.name : group.displayName

    // 如果这是未分组（旧格式），不要把它当作普通分组加入 emojiGroups
    if (group.id === 'ungrouped') {
      // 将处理后的表情直接加入 top-level ungrouped 列表
      processedEmojis.forEach((e) => ungrouped.push(e))
      // 仍然记录 id->UUID 映射和原始信息在 metadata 中，但不创建 group 对象
      return
    }

    // 普通分组，加入 processedGroups
    processedGroups.push({
      ...group,
      UUID: uuid,
      id: uuid, // 使用UUID作为新的id
      originalId: group.id, // 保留原始ID用于调试
      originalName: typeof group.name !== 'undefined' ? group.name : undefined,
      displayName: mappedDisplayName,
      emojis: processedEmojis,
    })
  })

  return { processedGroups, idToUuidMap, ungrouped }
}

function mapSettings(old, idToUuidMap) {
  const s = {}
  if (typeof old.imageScale !== 'undefined') s.imageScale = old.imageScale

  // 映射 defaultGroup ID 到真实 UUID
  if (typeof old.defaultGroup !== 'undefined') {
    s.defaultEmojiGroupUUID = idToUuidMap[old.defaultGroup] || old.defaultGroup
  } else {
    // 如果没有defaultGroup，使用第一个组的UUID或生成一个默认的
    s.defaultEmojiGroupUUID = '00000000-0000-0000-0000-000000000000'
  }

  if (typeof old.gridColumns !== 'undefined') s.gridColumns = old.gridColumns
  if (typeof old.outputFormat !== 'undefined') s.outputFormat = old.outputFormat
  s.MobileMode = !!old.forceMobileMode || !!old.MobileMode
  s.sidebarCollapsed = false
  if (typeof old.lastModified === 'number')
    s.lastModified = new Date(old.lastModified).toISOString()
  else if (typeof old.lastModified === 'string') s.lastModified = old.lastModified
  else s.lastModified = new Date().toISOString()
  return s
}

try {
  const txt = fs.readFileSync(src, 'utf8')
  const parsed = JSON.parse(txt)

  // 处理表情组并生成UUID映射
  const { processedGroups, idToUuidMap, ungrouped } = processGroups(parsed.groups || [])

  const payload = {
    version: 1,
    exportDate: new Date().toISOString(),
    emojiGroups: processedGroups,
    Settings: mapSettings(parsed.settings || parsed.Settings || {}, idToUuidMap),
    // 将旧格式的未分组表情放到 top-level ungrouped
    ungrouped: ungrouped || [],
    // 保存映射关系用于调试
    _metadata: {
      idToUuidMap,
      originalGroupCount: (parsed.groups || []).length,
      convertedAt: new Date().toISOString(),
    },
  }

  fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')
  console.log('Converted payload written to', out)
  console.log('ID to UUID mapping:', idToUuidMap)
  console.log('Total groups converted:', processedGroups.length)
  console.log('Settings defaultEmojiGroupUUID:', payload.Settings.defaultEmojiGroupUUID)

  // 输出完整的转换结果（截断以避免终端输出过长）
  const previewPayload = {
    ...payload,
    emojiGroups: payload.emojiGroups
      .map((g) => ({
        ...g,
        emojis: g.emojis.slice(0, 2), // 只显示前2个表情作为预览
      }))
      .slice(0, 3), // 只显示前3个组
  }
  console.log('\n=== Conversion Preview ===')
  console.log(JSON.stringify(previewPayload, null, 2))
} catch (err) {
  console.error('Failed to convert:', err)
  process.exit(2)
}
