import { useEmojiStore } from '../../stores/emojiStore'
import type { EmojiGroup } from '../../types/emoji'

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

      const name =
        alt.split('|')[0].trim() || decodeURIComponent((url.split('/').pop() || '').split('?')[0])
      const emojiData: any = { name, url }
      if (displayUrl) {
        emojiData.displayUrl = displayUrl
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
    if (targetGroupId) {
      items.forEach(emoji => {
        const emojiData = {
          packet: Number.isInteger(emoji.packet)
            ? emoji.packet
            : Date.now() + Math.floor(Math.random() * 1000),
          name: emoji.name || emoji.alt || '\u672a\u547d\u540d',
          url: emoji.url || emoji.src,
          ...(emoji.displayUrl && { displayUrl: emoji.displayUrl })
        }
        store.addEmojiWithoutSave(targetGroupId, emojiData)
      })
    } else {
      const groupMap = new Map<string, string>()
      store.groups.forEach((g: EmojiGroup) => {
        if (g && g.name && g.id) groupMap.set(g.name, g.id)
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
          name: emoji.name || emoji.alt || '\u672a\u547d\u540d',
          url: emoji.url || emoji.src,
          ...(emoji.displayUrl && { displayUrl: emoji.displayUrl })
        }
        if (targetId) store.addEmojiWithoutSave(targetId, emojiData)
      })
    }

    await store.saveData()
  } finally {
    await store.endBatch()
  }
}
