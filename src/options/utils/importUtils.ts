import { useEmojiStore } from '../../stores/emojiStore'
import type { EmojiGroup } from '../../types/type'

function generateEmojiName(emoji: any): string {
  const name = emoji.name || emoji.alt || '未命名'
  if (name.toLowerCase() === 'image') {
    // Generate a random UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
  return name
}

export async function importConfigurationToStore(config: any) {
  const store = useEmojiStore()
  // simple validation
  if (!config) throw new Error('empty config')
  store.importConfiguration(config)
}

export async function importEmojisToStore(payload: any, targetGroupId?: string) {
  // payload can be either:
  // - an array of emoji items
  // - an object: { exportedAt, group: { id, name, ... }, emojis: [...] }
  // - a markdown string containing image links like: ![alt](upload://abc.webp) ...
  //    in that case we'll parse the markdown and convert to an items array
  if (typeof payload === 'string') {
    const md = payload as string
    const mdItems: any[] = []
    // match markdown image syntax: ![alt](url "title") or ![alt](url "displayUrl")
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g
    let match: RegExpExecArray | null = null
    while ((match = re.exec(md)) !== null) {
      const alt = (match[1] || '').trim()
      const urlPart = (match[2] || '').trim()

      // Parse URL and optional display URL from title
      const urlTokens = urlPart.split(/\s+/)
      const url = urlTokens[0].replace(/^['"]|['"]$/g, '').trim()

      // Check if there's a second URL in quotes (as title) - this can be used as displayUrl
      let displayUrl: string | undefined
      if (urlTokens.length > 1) {
        const titlePart = urlTokens
          .slice(1)
          .join(' ')
          .replace(/^['"]|['"]$/g, '')
          .trim()
        // If the title looks like a URL, use it as display URL
        if (titlePart.startsWith('http://') || titlePart.startsWith('https://')) {
          displayUrl = titlePart
        }
      }

      // 解析名称和尺寸：支持格式 "filename|WIDTHxHEIGHT" 如 "image.avif|2000x2000"
      const altParts = alt.split('|')
      const rawName = altParts[0].trim()
      let width: number | undefined
      let height: number | undefined

      if (altParts.length > 1) {
        const sizeMatch = altParts[1].trim().match(/^(\d+)x(\d+)$/)
        if (sizeMatch) {
          width = parseInt(sizeMatch[1], 10)
          height = parseInt(sizeMatch[2], 10)
        }
      }

      const name = rawName || decodeURIComponent((url.split('/').pop() || '').split('?')[0])
      const emojiData: any = { name, url }
      if (displayUrl) {
        emojiData.displayUrl = displayUrl
      }
      if (width && height) {
        emojiData.width = width
        emojiData.height = height
      }
      mdItems.push(emojiData)
    }
    if (mdItems.length > 0) {
      payload = mdItems
    }
  }
  const store = useEmojiStore()

  let items: any[] = []
  let inferredGroupName: string | undefined
  const payloadGroup =
    payload && payload.group && typeof payload.group === 'object' ? (payload.group as any) : null

  // 支持多种导入格式：
  // 1) 直接数组 -> 每项为 emoji
  // 2) { emojis: [...] } -> 兼容旧导出格式
  if (Array.isArray(payload)) {
    items = payload
  } else if (payload && Array.isArray(payload.emojis)) {
    items = payload.emojis
    // prefer group.name, fallback to group.id
    inferredGroupName = (payload.group && (payload.group.name || payload.group.id))?.toString()
  } else {
    throw new Error('items must be array or object with emojis[]')
  }

  store.beginBatch()
  try {
    let forcedTargetGroupId: string | undefined

    if (!targetGroupId && payloadGroup && (payloadGroup.id || payloadGroup.name)) {
      const payloadGroupId = payloadGroup.id ? payloadGroup.id.toString() : ''
      const payloadGroupName = (payloadGroup.name || payloadGroupId || '').toString()
      const payloadGroupIcon = (payloadGroup.icon || '📁').toString()
      const payloadGroupDetail = payloadGroup.detail
      const payloadGroupOrder =
        Number.isFinite(payloadGroup.order) && payloadGroup.order >= 0 ? payloadGroup.order : undefined

      if (payloadGroupId) {
        const existing = store.groups.find((g: EmojiGroup) => g.id === payloadGroupId)
        if (existing) {
          const updates: Partial<EmojiGroup> = {}
          if (payloadGroupName && existing.name !== payloadGroupName) updates.name = payloadGroupName
          if (payloadGroup.icon && existing.icon !== payloadGroupIcon) updates.icon = payloadGroupIcon
          if (payloadGroupDetail !== undefined && existing.detail !== payloadGroupDetail)
            updates.detail = payloadGroupDetail
          if (payloadGroupOrder !== undefined && existing.order !== payloadGroupOrder)
            updates.order = payloadGroupOrder
          if (Object.keys(updates).length > 0) {
            store.updateGroup(payloadGroupId, updates)
          }
        } else {
          store.createGroupWithoutSave(payloadGroupName || payloadGroupId, payloadGroupIcon, payloadGroupId)
          if (payloadGroupDetail !== undefined || payloadGroupOrder !== undefined) {
            store.updateGroup(payloadGroupId, {
              ...(payloadGroupDetail !== undefined && { detail: payloadGroupDetail }),
              ...(payloadGroupOrder !== undefined && { order: payloadGroupOrder })
            })
          }
        }
        forcedTargetGroupId = payloadGroupId
      } else if (payloadGroupName) {
        const existing = store.groups.find((g: EmojiGroup) => g.name === payloadGroupName)
        if (existing) {
          const updates: Partial<EmojiGroup> = {}
          if (payloadGroup.icon && existing.icon !== payloadGroupIcon) updates.icon = payloadGroupIcon
          if (payloadGroupDetail !== undefined && existing.detail !== payloadGroupDetail)
            updates.detail = payloadGroupDetail
          if (payloadGroupOrder !== undefined && existing.order !== payloadGroupOrder)
            updates.order = payloadGroupOrder
          if (Object.keys(updates).length > 0) {
            store.updateGroup(existing.id, updates)
          }
          forcedTargetGroupId = existing.id
        } else {
          const created = store.createGroupWithoutSave(payloadGroupName, payloadGroupIcon)
          if (payloadGroupDetail !== undefined || payloadGroupOrder !== undefined) {
            store.updateGroup(created.id, {
              ...(payloadGroupDetail !== undefined && { detail: payloadGroupDetail }),
              ...(payloadGroupOrder !== undefined && { order: payloadGroupOrder })
            })
          }
          forcedTargetGroupId = created.id
        }
      }
    }

    const effectiveTargetGroupId = targetGroupId || forcedTargetGroupId

    if (effectiveTargetGroupId) {
      items.forEach(emoji => {
        const emojiData = {
          packet: Number.isInteger(emoji.packet)
            ? emoji.packet
            : Date.now() + Math.floor(Math.random() * 1000),
          name: generateEmojiName(emoji),
          url: emoji.url || emoji.src,
          ...(emoji.displayUrl && { displayUrl: emoji.displayUrl }),
          ...(emoji.originUrl && { originUrl: emoji.originUrl }),
          ...(emoji.width && { width: emoji.width }),
          ...(emoji.height && { height: emoji.height }),
          ...(emoji.tags && Array.isArray(emoji.tags) && { tags: emoji.tags }),
          ...(emoji.customOutput && { customOutput: emoji.customOutput }),
          ...(emoji.perceptualHash && { perceptualHash: emoji.perceptualHash }),
          ...(emoji.usageCount && { usageCount: emoji.usageCount }),
          ...(emoji.lastUsed && { lastUsed: emoji.lastUsed }),
          ...(emoji.addedAt && { addedAt: emoji.addedAt }),
          ...(emoji.referenceId && { referenceId: emoji.referenceId })
        }
        store.addEmojiWithoutSave(effectiveTargetGroupId, emojiData)
      })
    } else {
      const groupMap = new Map<string, string>()
      store.groups.forEach((g: EmojiGroup) => {
        if (g && g.name && g.id) {
          groupMap.set(g.name, g.id)
          groupMap.set(g.id, g.id)
        }
      })

      items.forEach(emoji => {
        // item.groupId might be either a group id or a group name depending on source
        const rawGroup = emoji.groupId || emoji.group || inferredGroupName || '\u672a\u5206\u7ec4'
        const groupName = rawGroup.toString()
        let targetId = groupMap.get(groupName)
        if (!targetId) {
          const created = store.createGroupWithoutSave(groupName, '\ud83d\udcc1')
          if (created && created.id) {
            targetId = created.id
            groupMap.set(groupName, targetId)
          } else {
            targetId = store.groups[0]?.id || 'nachoneko'
            if (targetId) groupMap.set(groupName, targetId)
          }
        }
        const emojiData = {
          packet: Number.isInteger(emoji.packet)
            ? emoji.packet
            : Date.now() + Math.floor(Math.random() * 1000),
          name: generateEmojiName(emoji),
          url: emoji.url || emoji.src,
          ...(emoji.displayUrl && { displayUrl: emoji.displayUrl }),
          ...(emoji.originUrl && { originUrl: emoji.originUrl }),
          ...(emoji.width && { width: emoji.width }),
          ...(emoji.height && { height: emoji.height }),
          ...(emoji.tags && Array.isArray(emoji.tags) && { tags: emoji.tags }),
          ...(emoji.customOutput && { customOutput: emoji.customOutput }),
          ...(emoji.perceptualHash && { perceptualHash: emoji.perceptualHash }),
          ...(emoji.usageCount && { usageCount: emoji.usageCount }),
          ...(emoji.lastUsed && { lastUsed: emoji.lastUsed }),
          ...(emoji.addedAt && { addedAt: emoji.addedAt }),
          ...(emoji.referenceId && { referenceId: emoji.referenceId })
        }
        if (targetId) store.addEmojiWithoutSave(targetId, emojiData)
      })
    }

    await store.saveData()
  } finally {
    await store.endBatch()
  }
}
