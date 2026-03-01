/**
 * 表情短码解析器
 * 支持 `:表情名称:` 格式的短码转换为 BBCode 或 Markdown
 */

export interface EmojiShortcode {
  name: string
  url: string
  id: string
  width?: number
  height?: number
}

// 表情名称到 URL 的映射（从 linux.do 内置表情加载）
const emojiMap = new Map<string, EmojiShortcode>()

/**
 * 添加表情到映射表
 */
export function addEmojiToMap(emoji: EmojiShortcode): void {
  emojiMap.set(emoji.name, emoji)
}

/**
 * 批量添加表情
 */
export function addEmojisToMap(emojis: EmojiShortcode[]): void {
  emojis.forEach(emoji => {
    emojiMap.set(emoji.name, emoji)
  })
}

/**
 * 根据 name 查找表情
 */
export function findEmojiByName(name: string): EmojiShortcode | undefined {
  return emojiMap.get(name)
}

/**
 * 解析表情短码为 BBCode
 * @param text 输入文本
 * @returns 包含 BBCode 表情的文本
 */
export function parseEmojiShortcodeToBBCode(text: string): string {
  // 匹配 `:表情名称:` 格式的短码
  // 注意：排除转义的 `\:name\:` 和 markdown 链接中的冒号
  return text.replace(
    /(^|[^\\]):([a-zA-Z0-9_\u4e00-\u9fa5]+):($|[^\\])/g,
    (match, before, name, after) => {
      const emoji = findEmojiByName(name)
      if (emoji) {
        // 使用表情的实际尺寸（如果有）
        return `${before}[img]${emoji.url}[/img]${after}`
      }
      return match
    }
  )
}

/**
 * 解析表情短码为 Markdown
 * @param text 输入文本
 * @returns 包含 Markdown 表情的文本
 */
export function parseEmojiShortcodeToMarkdown(text: string): string {
  // 匹配 `:表情名称:` 格式的短码
  return text.replace(
    /(^|[^\\]):([a-zA-Z0-9_\u4e00-\u9fa5]+):($|[^\\])/g,
    (match, before, name, after) => {
      const emoji = findEmojiByName(name)
      if (emoji) {
        const sizeAttr = emoji.width && emoji.height ? `|${emoji.width}x${emoji.height}` : ''
        return `${before}![${emoji.name}${sizeAttr}](${emoji.url})${after}`
      }
      return match
    }
  )
}

/**
 * 解析表情短码为 HTML（用于预览）
 * @param text 输入文本
 * @param imageScale 图片缩放比例（默认 30%）
 * @returns 包含 HTML 表情的文本
 */
export function parseEmojiShortcodeToHTML(text: string, imageScale: number = 30): string {
  return text.replace(
    /(^|[^\\]):([a-zA-Z0-9_\u4e00-\u9fa5]+):($|[^\\])/g,
    (match, before, name, after) => {
      const emoji = findEmojiByName(name)
      if (emoji) {
        const style =
          emoji.width && emoji.height
            ? `width: ${emoji.width * (imageScale / 100)}px; height: ${emoji.height * (imageScale / 100)}px;`
            : `max-width: 80px; max-height: 80px;`
        return `${before}<img src="${emoji.url}" alt="${emoji.name}" style="${style}" class="emoji-inline" />${after}`
      }
      return match
    }
  )
}

/**
 * 从 BBCode 转换回表情短码（可选功能）
 * @param text BBCode 文本
 * @returns 包含表情短码的文本
 */
export function convertBBCodeToEmojiShortcode(text: string): string {
  return text.replace(/\[img\]([^[]+?)\[\/img\]/g, (match, url) => {
    // 查找匹配的 URL
    for (const [name, emoji] of emojiMap.entries()) {
      if (emoji.url === url) {
        return `:${name}:`
      }
    }
    return match
  })
}

/**
 * 从 Markdown 转换回表情短码（可选功能）
 * @param text Markdown 文本
 * @returns 包含表情短码的文本
 */
export function convertMarkdownToEmojiShortcode(text: string): string {
  return text.replace(/!\[([^\]]*?)\]\([^)]+\)/g, (match, alt) => {
    // 从 alt 文本中提取表情名称
    // 格式可能是 `name` 或 `name|widthxheight`
    const name = alt.split('|')[0]
    const emoji = findEmojiByName(name)
    if (emoji) {
      return `:${name}:`
    }
    return match
  })
}

/**
 * 获取所有表情名称列表（用于搜索）
 */
export function getAllEmojiNames(): string[] {
  return Array.from(emojiMap.keys())
}

/**
 * 搜索表情（支持中文名称和 ID）
 */
export function searchEmojis(query: string): EmojiShortcode[] {
  if (!query.trim()) {
    return Array.from(emojiMap.values())
  }

  const lowerQuery = query.toLowerCase()
  return Array.from(emojiMap.values()).filter(
    emoji =>
      emoji.name.toLowerCase().includes(lowerQuery) || emoji.id.toLowerCase().includes(lowerQuery)
  )
}

/**
 * 清空表情映射表
 */
export function clearEmojiMap(): void {
  emojiMap.clear()
}

/**
 * 获取表情映射表的大小
 */
export function getEmojiMapSize(): number {
  return emojiMap.size
}
