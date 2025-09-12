// 兼容性导出，重新导出所有helper函数
export * from './helpers'

// 为了保持向后兼容，保留原来的函数名
export { performEmojiAddFlow as performPixivAddEmojiFlow } from './helpers/background'
