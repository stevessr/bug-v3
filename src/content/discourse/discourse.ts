import { initEmojiPicker } from './emoji-picker'
import { initCustomMenu } from './custom-menu'
import { initEmojiAdd } from './emoji-add'
import { initUploadListener } from './upload-listener'

/** 判断当前页面是否为 Discourse（通过显式 meta 标签检测） */
function isDiscoursePage(): boolean {
  try {
    const gen = document.querySelector('meta[name="generator"]')?.getAttribute('content') || ''
    if (gen.toLowerCase().includes('discourse')) return true
    if (document.querySelector('meta[name^="discourse_"]')) return true
    if (document.getElementById('data-discourse-setup')) return true
    if (document.querySelector('meta[name="discourse/config/environment"]')) return true
    return false
  } catch (e) {
    return false
  }
}

export function initDiscourse() {
  try {
    if (!isDiscoursePage()) return

    // Initialize split modules. Each module is responsible for its own observers/handlers.
    initEmojiPicker()
    initCustomMenu()
    initEmojiAdd()
    initUploadListener()
  } catch (_e) {
    // noop
  }
}

// 自动初始化入口，注入即执行
try {
  initDiscourse()
} catch (_e) {
  // noop
}
