// content-script/content/picker.ts - 表情选择器主入口文件（重构后）

// 导入拆分的模块
import { createEmojiPicker as createEmojiPickerCore, isMobile } from './picker/emoji-picker-core'
import { setupCacheListeners } from './picker/cache-manager'

// 导出主要函数供外部使用
export async function createEmojiPicker(isMobilePicker: boolean): Promise<HTMLElement> {
  return createEmojiPickerCore(isMobilePicker)
}

// 导出工具函数
export { isMobile }

// 初始化缓存监听器
setupCacheListeners()