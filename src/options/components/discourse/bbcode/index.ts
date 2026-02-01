/**
 * BBCode Module
 * Exports all BBCode-related functionality
 */

export { parseBBCode, sanitizeBBCode, renderBBCode } from './parser'
export { showColorPicker, showColorPickerAtButton } from './colorPicker'
export type { ColorPickerOptions } from './colorPicker'
export {
  addEmojiToMap,
  addEmojisToMap,
  findEmojiByName,
  parseEmojiShortcodeToBBCode,
  parseEmojiShortcodeToMarkdown,
  parseEmojiShortcodeToHTML,
  convertBBCodeToEmojiShortcode,
  convertMarkdownToEmojiShortcode,
  getAllEmojiNames,
  searchEmojis,
  clearEmojiMap,
  getEmojiMapSize
} from './emojiShortcode'
export type { EmojiShortcode } from './emojiShortcode'